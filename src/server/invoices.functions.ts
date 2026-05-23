/** Server functions per fatture: numerazione e generazione XML SdI. */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { buildBillingWorkbook, type BillingExportKind } from "@/lib/billing-xlsx";
import { computeInvoice } from "@/lib/invoice-calc";
import { buildInvoiceXml } from "@/lib/invoice-xml";
import { buildBillingExportStoragePath, PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import {
  assertIncludedActivitiesBillable,
  assertIncludedActivitiesEditable,
  billedPartyForInvoiceXml,
  buildBillingExportRows,
  buildBillingExportRowsFromInvoiceLines,
  buildBillingRunItemRows,
  buildBillingRunRow,
  buildInvoiceLineRows,
  buildInvoiceRow,
  buildInvoiceUpdateRow,
  firstIncludedClientId,
  includedActivityUpdateForInvoiceStatus,
  invoiceLinesForTotals,
  partitionBillingActivities,
  draftPostponedActivityUpdate,
  postponedActivityUpdate,
  selectedActivityIds,
  selectionMap,
  validateCreateBillingInvoiceInput,
  validateUpdateDraftBillingInvoiceInput,
  type BillingActivity,
  type BillingItemStatus,
  type CreateBillingInvoiceInput,
  type InvoiceXmlPrincipal,
  type UpdateDraftBillingInvoiceInput,
} from "@/server/invoice-billing.logic";

async function reserveNextInvoiceNumber(supabase: SupabaseClient<Database>, userId: string) {
  const currentYear = new Date().getFullYear();

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("invoice_year, invoice_next_number, invoice_number_prefix")
    .eq("id", userId)
    .single();
  if (pErr) throw pErr;

  let year = profile?.invoice_year ?? currentYear;
  let next = profile?.invoice_next_number ?? 1;
  const prefix = profile?.invoice_number_prefix ?? "";

  if (year !== currentYear) {
    year = currentYear;
    next = 1;
  }

  const formatted = prefix ? `${prefix}${next}` : String(next);

  const { error: uErr } = await supabase
    .from("profiles")
    .update({ invoice_year: year, invoice_next_number: next + 1 })
    .eq("id", userId);
  if (uErr) throw uErr;

  return { number: formatted, year };
}

/** Restituisce e incrementa il prossimo numero fattura per l'anno corrente. */
export const reserveInvoiceNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => reserveNextInvoiceNumber(context.supabase, context.userId));

async function saveBillingExports({
  supabase,
  userId,
  billingRunId,
  invoiceId,
  principalName,
  periodStart,
  periodEnd,
  included,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  billingRunId: string;
  invoiceId: string;
  principalName: string;
  periodStart: string;
  periodEnd: string;
  included: BillingActivity[];
}) {
  const exportsToSave = [
    buildBillingWorkbook({
      kind: "fees",
      principalName,
      periodStart,
      periodEnd,
      rows: buildBillingExportRows(included, "fee"),
    }),
    buildBillingWorkbook({
      kind: "expenses",
      principalName,
      periodStart,
      periodEnd,
      rows: buildBillingExportRows(included, "expense_reimbursement"),
    }),
  ];

  const savedExports = [];
  for (const file of exportsToSave) {
    const storagePath = buildBillingExportStoragePath(userId, billingRunId, file.fileName);
    const { error: uploadError } = await supabase.storage
      .from(PRATIX_DOCUMENTS_BUCKET)
      .upload(storagePath, Buffer.from(file.bytes), {
        contentType: file.mimeType,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: billingExport, error: exportError } = await supabase
      .from("billing_exports")
      .insert({
        user_id: userId,
        billing_run_id: billingRunId,
        invoice_id: invoiceId,
        kind: file.fileName.startsWith("compensi") ? "fees" : "expenses",
        storage_path: storagePath,
        file_name: file.fileName,
        mime_type: file.mimeType,
        size_bytes: file.bytes.byteLength,
      })
      .select("id, file_name")
      .single();
    if (exportError) throw exportError;
    savedExports.push(billingExport);
  }

  return savedExports;
}

export const createBillingInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateCreateBillingInvoiceInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const selectedIds = selectedActivityIds(data.selections);
    const selectionById = selectionMap(data.selections);

    const [{ data: principal, error: principalError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("principals")
          .select("id, business_name, default_general_expenses_rate")
          .eq("id", data.principalId)
          .eq("user_id", userId)
          .single(),
        supabase
          .from("profiles")
          .select("tax_regime, include_stamp_duty")
          .eq("id", userId)
          .single(),
      ]);
    if (principalError) throw principalError;
    if (profileError) throw profileError;
    if (!principal) throw new Error("Committente non trovato");

    const { data: activities, error: activitiesError } = await supabase
      .from("case_activities")
      .select(
        "id, case_id, principal_id, client_id, counterparty_id, activity_date, kind, status, invoice_id, description, quantity, unit_price, amount, postponed_count, cases(practice_number, title), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name), case_activity_hearings(hearing_date, position)",
      )
      .eq("user_id", userId)
      .eq("principal_id", data.principalId)
      .in("id", selectedIds);
    if (activitiesError) throw activitiesError;
    if (!activities || activities.length !== selectedIds.length) {
      throw new Error("Una o più attività non sono disponibili");
    }

    const { included, postponed } = partitionBillingActivities(
      activities as BillingActivity[],
      selectionById,
    );
    const firstIncluded = included[0];
    firstIncludedClientId(included);
    assertIncludedActivitiesBillable(included);

    const totals = computeInvoice(invoiceLinesForTotals(included), {
      cassaRate: Number(data.cassaRate),
      vatRate: Number(data.vatRate),
      withholdingRate: Number(data.withholdingRate),
      applyWithholding: data.applyWithholding,
      taxRegime: profile?.tax_regime === "forfettario" ? "forfettario" : "ordinario",
      includeGeneralExpenses: data.includeGeneralExpenses,
      generalExpensesRate: Number(data.generalExpensesRate),
      includeStampDuty: Boolean(profile?.include_stamp_duty),
    });

    const { number, year } = await reserveNextInvoiceNumber(supabase, userId);

    const { data: billingRun, error: billingRunError } = await supabase
      .from("billing_runs")
      .insert(buildBillingRunRow({ input: data, userId, totals }))
      .select("id")
      .single();
    if (billingRunError) throw billingRunError;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert(
        buildInvoiceRow({
          input: data,
          userId,
          billingRunId: billingRun.id,
          firstIncluded,
          number,
          year,
          totals,
        }),
      )
      .select("id, public_code")
      .single();
    if (invoiceError) throw invoiceError;

    const invoiceLineRows = buildInvoiceLineRows({
      input: data,
      userId,
      invoiceId: invoice.id,
      included,
      totals,
    });

    const { error: linesError } = await supabase.from("invoice_lines").insert(invoiceLineRows);
    if (linesError) throw linesError;

    const { error: itemsError } = await supabase.from("billing_run_items").insert(
      buildBillingRunItemRows({
        activities: activities as BillingActivity[],
        billingRunId: billingRun.id,
        selections: selectionById,
        userId,
      }),
    );
    if (itemsError) throw itemsError;

    if (included.length > 0) {
      const { error: includedError } = await supabase
        .from("case_activities")
        .update(
          includedActivityUpdateForInvoiceStatus({
            invoiceId: invoice.id,
            invoiceStatus: data.status,
          }),
        )
        .in(
          "id",
          included.map((activity) => activity.id),
        );
      if (includedError) throw includedError;
    }

    for (const activity of postponed) {
      const update = postponedActivityUpdate(activity, data.periodEnd);
      const { error: postponedError } = await supabase
        .from("case_activities")
        .update({
          postponed_until: update.postponed_until,
          postponed_count: update.postponed_count,
        })
        .eq("id", update.id);
      if (postponedError) throw postponedError;
    }

    const savedExports = await saveBillingExports({
      supabase,
      userId,
      billingRunId: billingRun.id,
      invoiceId: invoice.id,
      principalName: principal.business_name,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      included,
    });

    const { error: runUpdateError } = await supabase
      .from("billing_runs")
      .update({ invoice_id: invoice.id })
      .eq("id", billingRun.id);
    if (runUpdateError) throw runUpdateError;

    return {
      invoiceId: invoice.id,
      invoiceRef: invoice.public_code ?? invoice.id,
      billingRunId: billingRun.id,
      number,
      year,
      exports: savedExports,
    };
  });

export const updateDraftBillingInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateUpdateDraftBillingInvoiceInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const selectedIds = selectedActivityIds(data.selections);
    const selectionById = selectionMap(data.selections);

    const [{ data: invoice, error: invoiceError }, { data: principal, error: principalError }] =
      await Promise.all([
        supabase
          .from("invoices")
          .select("id, public_code, number, year, status, billing_run_id")
          .eq("id", data.invoiceId)
          .eq("user_id", userId)
          .single(),
        supabase
          .from("principals")
          .select("id, business_name, default_general_expenses_rate")
          .eq("id", data.principalId)
          .eq("user_id", userId)
          .single(),
      ]);
    if (invoiceError) throw invoiceError;
    if (principalError) throw principalError;
    if (!invoice) throw new Error("Fattura non trovata");
    if (invoice.status !== "draft") throw new Error("Solo le fatture in bozza sono modificabili");
    if (!invoice.billing_run_id) throw new Error("Bozza senza rendiconto collegato");
    if (!principal) throw new Error("Committente non trovato");

    const [{ data: profile, error: profileError }, { data: activities, error: activitiesError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("tax_regime, include_stamp_duty")
          .eq("id", userId)
          .single(),
        supabase
          .from("case_activities")
          .select(
            "id, case_id, principal_id, client_id, counterparty_id, activity_date, kind, status, invoice_id, description, quantity, unit_price, amount, postponed_count, cases(practice_number, title), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name), case_activity_hearings(hearing_date, position)",
          )
          .eq("user_id", userId)
          .eq("principal_id", data.principalId)
          .in("id", selectedIds),
      ]);
    if (profileError) throw profileError;
    if (activitiesError) throw activitiesError;
    if (!activities || activities.length !== selectedIds.length) {
      throw new Error("Una o più attività non sono disponibili");
    }

    const { included, postponed } = partitionBillingActivities(
      activities as BillingActivity[],
      selectionById,
    );
    const firstIncluded = included[0];
    firstIncludedClientId(included);
    assertIncludedActivitiesEditable(included, invoice.id);

    const totals = computeInvoice(invoiceLinesForTotals(included), {
      cassaRate: Number(data.cassaRate),
      vatRate: Number(data.vatRate),
      withholdingRate: Number(data.withholdingRate),
      applyWithholding: data.applyWithholding,
      taxRegime: profile?.tax_regime === "forfettario" ? "forfettario" : "ordinario",
      includeGeneralExpenses: data.includeGeneralExpenses,
      generalExpensesRate: Number(data.generalExpensesRate),
      includeStampDuty: Boolean(profile?.include_stamp_duty),
    });

    const { data: previousItems, error: previousItemsError } = await supabase
      .from("billing_run_items")
      .select("activity_id, status")
      .eq("billing_run_id", invoice.billing_run_id);
    if (previousItemsError) throw previousItemsError;
    const previousStatusByActivityId = new Map<string, BillingItemStatus>(
      (previousItems ?? []).map((item) => [item.activity_id, item.status as BillingItemStatus]),
    );

    const { error: currentActivitiesError } = await supabase
      .from("case_activities")
      .update({ status: "to_invoice", invoice_id: null })
      .eq("invoice_id", invoice.id);
    if (currentActivitiesError) throw currentActivitiesError;

    const { data: previousExports, error: previousExportsError } = await supabase
      .from("billing_exports")
      .select("storage_path")
      .eq("billing_run_id", invoice.billing_run_id);
    if (previousExportsError) throw previousExportsError;
    const previousPaths = (previousExports ?? []).map((item) => item.storage_path).filter(Boolean);
    if (previousPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(PRATIX_DOCUMENTS_BUCKET)
        .remove(previousPaths);
      if (storageError) throw storageError;
    }
    const { error: exportsDeleteError } = await supabase
      .from("billing_exports")
      .delete()
      .eq("billing_run_id", invoice.billing_run_id);
    if (exportsDeleteError) throw exportsDeleteError;

    const { error: linesDeleteError } = await supabase
      .from("invoice_lines")
      .delete()
      .eq("invoice_id", invoice.id);
    if (linesDeleteError) throw linesDeleteError;

    const { error: itemsDeleteError } = await supabase
      .from("billing_run_items")
      .delete()
      .eq("billing_run_id", invoice.billing_run_id);
    if (itemsDeleteError) throw itemsDeleteError;

    const { error: runUpdateError } = await supabase
      .from("billing_runs")
      .update(buildBillingRunRow({ input: data, userId, totals }))
      .eq("id", invoice.billing_run_id);
    if (runUpdateError) throw runUpdateError;

    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update(buildInvoiceUpdateRow({ input: data, firstIncluded, totals }))
      .eq("id", invoice.id);
    if (invoiceUpdateError) throw invoiceUpdateError;

    const { error: linesError } = await supabase.from("invoice_lines").insert(
      buildInvoiceLineRows({
        input: data,
        userId,
        invoiceId: invoice.id,
        included,
        totals,
      }),
    );
    if (linesError) throw linesError;

    const { error: itemsError } = await supabase.from("billing_run_items").insert(
      buildBillingRunItemRows({
        activities: activities as BillingActivity[],
        billingRunId: invoice.billing_run_id,
        selections: selectionById,
        userId,
      }),
    );
    if (itemsError) throw itemsError;

    if (included.length > 0) {
      const { error: includedError } = await supabase
        .from("case_activities")
        .update(
          includedActivityUpdateForInvoiceStatus({
            invoiceId: invoice.id,
            invoiceStatus: data.status,
          }),
        )
        .in(
          "id",
          included.map((activity) => activity.id),
        );
      if (includedError) throw includedError;
    }

    for (const activity of postponed) {
      const update = draftPostponedActivityUpdate({
        activity,
        periodEnd: data.periodEnd,
        previousStatus: previousStatusByActivityId.get(activity.id),
      });
      const { error: postponedError } = await supabase
        .from("case_activities")
        .update({
          postponed_until: update.postponed_until,
          postponed_count: update.postponed_count,
        })
        .eq("id", update.id);
      if (postponedError) throw postponedError;
    }

    const savedExports = await saveBillingExports({
      supabase,
      userId,
      billingRunId: invoice.billing_run_id,
      invoiceId: invoice.id,
      principalName: principal.business_name,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      included,
    });

    return {
      invoiceId: invoice.id,
      invoiceRef: invoice.public_code ?? invoice.id,
      billingRunId: invoice.billing_run_id,
      number: invoice.number,
      year: invoice.year,
      exports: savedExports,
    };
  });

type SetInvoiceIssueStateInput = {
  invoiceId: string;
  issued: boolean;
};

function validateSetInvoiceIssueStateInput(input: Partial<SetInvoiceIssueStateInput> | undefined) {
  if (!input?.invoiceId || typeof input.invoiceId !== "string") {
    throw new Error("Fattura non valida");
  }
  if (typeof input.issued !== "boolean") {
    throw new Error("Stato fattura non valido");
  }
  return { invoiceId: input.invoiceId, issued: input.issued };
}

export const setInvoiceIssueStateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSetInvoiceIssueStateInput)
  .handler(async ({ data, context }) => {
    const { data: invoiceId, error } = await context.supabase.rpc("set_invoice_issue_state", {
      p_invoice_id: data.invoiceId,
      p_issued: data.issued,
    });
    if (error) throw error;
    if (!invoiceId) {
      throw new Error(
        data.issued
          ? "Solo le fatture in bozza possono essere emesse"
          : "Solo le fatture emesse possono tornare in bozza",
      );
    }
    return { invoiceId };
  });

export const generateBillingExportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string; kind: BillingExportKind }) => {
    if (!input?.invoiceId || typeof input.invoiceId !== "string") {
      throw new Error("invoiceId mancante");
    }
    if (input.kind !== "fees" && input.kind !== "expenses") {
      throw new Error("Tipo rendiconto non valido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, billing_run_id, principal_id")
      .eq("id", data.invoiceId)
      .eq("user_id", userId)
      .single();
    if (invoiceError) throw invoiceError;
    if (!invoice?.billing_run_id) throw new Error("Rendiconto non disponibile");
    if (!invoice.principal_id) throw new Error("Committente della fattura non trovato");

    const [{ data: billingRun, error: runError }, { data: principal, error: principalError }] =
      await Promise.all([
        supabase
          .from("billing_runs")
          .select("period_start, period_end")
          .eq("id", invoice.billing_run_id)
          .eq("user_id", userId)
          .single(),
        supabase
          .from("principals")
          .select("business_name")
          .eq("id", invoice.principal_id)
          .eq("user_id", userId)
          .single(),
      ]);
    if (runError) throw runError;
    if (principalError) throw principalError;

    const { data: lines, error: linesError } = await supabase
      .from("invoice_lines")
      .select(
        "case_activity_id, practice_number, client_name, counterparty_name, activity_date, kind, description, quantity, unit_price, amount",
      )
      .eq("user_id", userId)
      .eq("invoice_id", invoice.id)
      .eq("kind", data.kind === "fees" ? "fee" : "expense_art15")
      .order("position", { ascending: true });
    if (linesError) throw linesError;
    const activityIds = [
      ...new Set((lines ?? []).map((line) => line.case_activity_id).filter(Boolean)),
    ] as string[];
    const hearingsByActivityId = new Map<
      string,
      Array<{ hearing_date: string; position: number | string }>
    >();

    if (data.kind === "fees" && activityIds.length > 0) {
      const { data: hearings, error: hearingsError } = await supabase
        .from("case_activity_hearings")
        .select("activity_id, hearing_date, position")
        .eq("user_id", userId)
        .in("activity_id", activityIds)
        .order("position", { ascending: true });
      if (hearingsError) throw hearingsError;

      for (const hearing of hearings ?? []) {
        const current = hearingsByActivityId.get(hearing.activity_id) ?? [];
        current.push({ hearing_date: hearing.hearing_date, position: hearing.position });
        hearingsByActivityId.set(hearing.activity_id, current);
      }
    }
    const linesWithHearings = (lines ?? []).map((line) => ({
      ...line,
      case_activity_hearings: line.case_activity_id
        ? (hearingsByActivityId.get(line.case_activity_id) ?? [])
        : [],
    }));

    const file = buildBillingWorkbook({
      kind: data.kind,
      principalName: principal?.business_name ?? "committente",
      periodStart: billingRun.period_start,
      periodEnd: billingRun.period_end,
      rows: buildBillingExportRowsFromInvoiceLines(linesWithHearings, data.kind),
    });

    return {
      bytesBase64: Buffer.from(file.bytes).toString("base64"),
      fileName: file.fileName,
      mimeType: file.mimeType,
    };
  });

/** Genera l'XML FatturaPA 1.2.2 per una fattura esistente. */
export const generateInvoiceXmlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string }) => {
    if (!input?.invoiceId || typeof input.invoiceId !== "string") {
      throw new Error("invoiceId mancante");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: invoice, error: iErr }, { data: profile, error: pErr }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", data.invoiceId).eq("user_id", userId).single(),
      supabase.from("profiles").select("*").eq("id", userId).single(),
    ]);
    if (iErr) throw iErr;
    if (pErr) throw pErr;
    if (!invoice) throw new Error("Fattura non trovata");

    const [
      { data: lines, error: lErr },
      { data: principal, error: principalErr },
      { data: client, error: cErr },
    ] = await Promise.all([
      supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("position", { ascending: true }),
      invoice.principal_id
        ? supabase.from("principals").select("*").eq("id", invoice.principal_id).single()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("clients").select("*").eq("id", invoice.client_id).single(),
    ]);
    if (lErr) throw lErr;
    if (principalErr) throw principalErr;
    if (cErr && !principal) throw cErr;
    const billedParty = billedPartyForInvoiceXml(principal as InvoiceXmlPrincipal | null);

    const result = buildInvoiceXml({
      invoice: {
        number: invoice.number,
        year: invoice.year,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        payment_method: invoice.payment_method,
        cassa_rate: Number(invoice.cassa_rate),
        vat_rate: Number(invoice.vat_rate),
        withholding_rate: Number(invoice.withholding_rate),
        apply_withholding: invoice.apply_withholding,
        taxable_fees: Number(invoice.taxable_fees),
        taxable_expenses: Number(invoice.taxable_expenses),
        art15_expenses: Number(invoice.art15_expenses),
        general_expenses_amount: Number(invoice.general_expenses_amount),
        cassa_base_amount: Number(invoice.cassa_base_amount),
        cassa_amount: Number(invoice.cassa_amount),
        vat_amount: Number(invoice.vat_amount),
        withholding_amount: Number(invoice.withholding_amount),
        stamp_amount: Number(invoice.stamp_amount),
        total_amount: Number(invoice.total_amount),
      },
      lines: (lines || []).map((l) => ({
        kind: l.kind as "fee" | "expense_taxable" | "expense_art15",
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        amount: Number(l.amount),
      })),
      client: billedParty,
      profile: {
        business_name: profile?.business_name,
        full_name: profile?.full_name,
        vat_number: profile?.vat_number,
        tax_code: profile?.tax_code,
        address_street: profile?.address_street,
        address_zip: profile?.address_zip,
        address_city: profile?.address_city,
        address_province: profile?.address_province,
        address_country: profile?.address_country,
        tax_regime: profile?.tax_regime,
      },
    });

    return result;
  });
