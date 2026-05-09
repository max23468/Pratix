/** Server functions per fatture: numerazione e generazione XML SdI. */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { buildBillingWorkbook, type BillingExportRow } from "@/lib/billing-xlsx";
import { computeInvoice, type InvoiceLineInput } from "@/lib/invoice-calc";
import { buildInvoiceXml } from "@/lib/invoice-xml";
import { buildBillingExportStoragePath, PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import {
  billingDatePattern,
  billingPartyName,
  nextBillingPeriodStart,
} from "@/server/invoice-billing.helpers";

type BillingItemStatus = "included" | "postponed" | "excluded";

type BillingSelectionInput = {
  activityId: string;
  status: BillingItemStatus;
  notes?: string | null;
};

type CreateBillingInvoiceInput = {
  principalId: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate?: string | null;
  status: "draft" | "issued";
  includeGeneralExpenses: boolean;
  generalExpensesRate: number;
  cassaRate: number;
  vatRate: number;
  withholdingRate: number;
  applyWithholding: boolean;
  paymentMethod?: string | null;
  notes?: string | null;
  selections: BillingSelectionInput[];
};

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

export const createBillingInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateBillingInvoiceInput) => {
    if (!input?.principalId) throw new Error("Seleziona un committente");
    if (!billingDatePattern.test(input.periodStart) || !billingDatePattern.test(input.periodEnd)) {
      throw new Error("Periodo di fatturazione non valido");
    }
    if (input.periodEnd < input.periodStart) {
      throw new Error("La data fine periodo deve essere successiva alla data inizio");
    }
    if (!billingDatePattern.test(input.issueDate)) throw new Error("Data fattura non valida");
    if (input.dueDate && !billingDatePattern.test(input.dueDate)) {
      throw new Error("Scadenza non valida");
    }
    if (!Array.isArray(input.selections) || input.selections.length === 0) {
      throw new Error("Seleziona almeno un'attività");
    }
    if (!input.selections.some((selection) => selection.status === "included")) {
      throw new Error("Includi almeno un'attività in fattura");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const selectedIds = data.selections.map((selection) => selection.activityId);
    const selectionById = new Map(
      data.selections.map((selection) => [selection.activityId, selection]),
    );

    const [{ data: principal, error: principalError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("principals")
          .select("id, business_name, default_general_expenses_rate")
          .eq("id", data.principalId)
          .eq("user_id", userId)
          .single(),
        supabase.from("profiles").select("tax_regime").eq("id", userId).single(),
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

    const included = activities.filter(
      (activity) => selectionById.get(activity.id)?.status === "included",
    );
    const postponed = activities.filter(
      (activity) => selectionById.get(activity.id)?.status === "postponed",
    );
    const firstIncluded = included[0];
    if (!firstIncluded?.client_id) {
      throw new Error("Le attività incluse devono avere un cliente collegato");
    }

    for (const activity of included) {
      if (activity.status !== "to_invoice" || activity.invoice_id) {
        throw new Error("Una o più attività incluse risultano già fatturate");
      }
    }

    const invoiceLinesForTotals: InvoiceLineInput[] = included.map((activity) => ({
      kind: activity.kind === "fee" ? "fee" : "expense_art15",
      quantity: Number(activity.quantity),
      unit_price: Number(activity.unit_price),
    }));

    const totals = computeInvoice(invoiceLinesForTotals, {
      cassaRate: Number(data.cassaRate),
      vatRate: Number(data.vatRate),
      withholdingRate: Number(data.withholdingRate),
      applyWithholding: data.applyWithholding,
      taxRegime: profile?.tax_regime === "forfettario" ? "forfettario" : "ordinario",
      includeGeneralExpenses: data.includeGeneralExpenses,
      generalExpensesRate: Number(data.generalExpensesRate),
    });

    const { number, year } = await reserveNextInvoiceNumber(supabase, userId);

    const { data: billingRun, error: billingRunError } = await supabase
      .from("billing_runs")
      .insert({
        user_id: userId,
        principal_id: data.principalId,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        status: "finalized",
        include_general_expenses: data.includeGeneralExpenses,
        general_expenses_rate: data.generalExpensesRate,
        compensation_total: totals.taxableFees,
        general_expenses_amount: totals.generalExpensesAmount,
        cassa_rate: data.cassaRate,
        cassa_base_amount: totals.cassaBaseAmount,
        cassa_amount: totals.cassaAmount,
        reimbursements_total: totals.art15Expenses,
        notes: data.notes?.trim() || null,
      })
      .select("id")
      .single();
    if (billingRunError) throw billingRunError;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        client_id: firstIncluded.client_id,
        case_id: firstIncluded.case_id,
        principal_id: data.principalId,
        billing_run_id: billingRun.id,
        number,
        year,
        issue_date: data.issueDate,
        due_date: data.dueDate || null,
        status: data.status,
        cassa_rate: data.cassaRate,
        vat_rate: data.vatRate,
        withholding_rate: data.withholdingRate,
        apply_withholding: data.applyWithholding,
        taxable_fees: totals.taxableFees,
        taxable_expenses: totals.taxableExpenses,
        art15_expenses: totals.art15Expenses,
        general_expenses_amount: totals.generalExpensesAmount,
        general_expenses_rate: data.generalExpensesRate,
        include_general_expenses: data.includeGeneralExpenses,
        cassa_base_amount: totals.cassaBaseAmount,
        cassa_amount: totals.cassaAmount,
        vat_amount: totals.vatAmount,
        withholding_amount: totals.withholdingAmount,
        stamp_amount: totals.stampAmount,
        total_amount: totals.totalAmount,
        net_to_pay: totals.netToPay,
        payment_method: data.paymentMethod?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .select("id")
      .single();
    if (invoiceError) throw invoiceError;

    const invoiceLineRows = included.map((activity, index) => ({
      user_id: userId,
      invoice_id: invoice.id,
      position: index + 1,
      case_activity_id: activity.id,
      practice_number: activity.cases?.practice_number ?? null,
      client_name: billingPartyName(activity.clients),
      counterparty_name: billingPartyName(activity.counterparties),
      activity_date: activity.activity_date,
      kind: activity.kind === "fee" ? "fee" : "expense_art15",
      description: activity.description,
      quantity: Number(activity.quantity),
      unit_price: Number(activity.unit_price),
      amount: Number(activity.amount),
    }));

    if (totals.generalExpensesAmount > 0) {
      invoiceLineRows.push({
        user_id: userId,
        invoice_id: invoice.id,
        position: invoiceLineRows.length + 1,
        case_activity_id: null,
        practice_number: null,
        client_name: null,
        counterparty_name: null,
        activity_date: data.issueDate,
        kind: "fee",
        description: `Spese generali ${data.generalExpensesRate}%`,
        quantity: 1,
        unit_price: totals.generalExpensesAmount,
        amount: totals.generalExpensesAmount,
      });
    }

    const { error: linesError } = await supabase.from("invoice_lines").insert(invoiceLineRows);
    if (linesError) throw linesError;

    const { error: itemsError } = await supabase.from("billing_run_items").insert(
      activities.map((activity) => {
        const selection = selectionById.get(activity.id);
        return {
          user_id: userId,
          billing_run_id: billingRun.id,
          activity_id: activity.id,
          status: selection?.status ?? "excluded",
          notes: selection?.notes?.trim() || null,
        };
      }),
    );
    if (itemsError) throw itemsError;

    if (included.length > 0) {
      const { error: includedError } = await supabase
        .from("case_activities")
        .update({ status: "invoiced", invoice_id: invoice.id })
        .in(
          "id",
          included.map((activity) => activity.id),
        );
      if (includedError) throw includedError;
    }

    const postponedUntil = nextBillingPeriodStart(data.periodEnd);
    for (const activity of postponed) {
      const { error: postponedError } = await supabase
        .from("case_activities")
        .update({
          postponed_until: postponedUntil,
          postponed_count: Number(activity.postponed_count ?? 0) + 1,
        })
        .eq("id", activity.id);
      if (postponedError) throw postponedError;
    }

    const exportRows = (kind: "fee" | "expense_reimbursement"): BillingExportRow[] =>
      included
        .filter((activity) => activity.kind === kind)
        .map((activity) => ({
          practiceNumber: activity.cases?.practice_number ?? null,
          clientName: billingPartyName(activity.clients),
          counterpartyName: billingPartyName(activity.counterparties),
          activityDate: activity.activity_date,
          description: activity.description,
          quantity: Number(activity.quantity),
          unitPrice: Number(activity.unit_price),
          amount: Number(activity.amount),
          hearingDates: (activity.case_activity_hearings ?? [])
            .sort((a, b) => Number(a.position) - Number(b.position))
            .map((hearing) => hearing.hearing_date),
        }));

    const exportsToSave = [
      buildBillingWorkbook({
        kind: "fees",
        principalName: principal.business_name,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        rows: exportRows("fee"),
      }),
      buildBillingWorkbook({
        kind: "expenses",
        principalName: principal.business_name,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        rows: exportRows("expense_reimbursement"),
      }),
    ];

    const savedExports = [];
    for (const file of exportsToSave) {
      const storagePath = buildBillingExportStoragePath(userId, billingRun.id, file.fileName);
      const { error: uploadError } = await supabase.storage
        .from(PRATIX_DOCUMENTS_BUCKET)
        .upload(storagePath, Buffer.from(file.bytes), {
          contentType: file.mimeType,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: billingExport, error: exportError } = await supabase
        .from("billing_exports")
        .insert({
          user_id: userId,
          billing_run_id: billingRun.id,
          invoice_id: invoice.id,
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

    const { error: runUpdateError } = await supabase
      .from("billing_runs")
      .update({ invoice_id: invoice.id })
      .eq("id", billingRun.id);
    if (runUpdateError) throw runUpdateError;

    return {
      invoiceId: invoice.id,
      billingRunId: billingRun.id,
      number,
      year,
      exports: savedExports,
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
    const billedParty = principal
      ? {
          kind: "company",
          first_name: null,
          last_name: null,
          business_name: principal.business_name,
          tax_code: principal.tax_code,
          vat_number: principal.vat_number,
          sdi_code: principal.sdi_code,
          pec: principal.pec,
          address_street: principal.address_street,
          address_zip: principal.address_zip,
          address_city: principal.address_city,
          address_province: principal.address_province,
          address_country: principal.address_country,
        }
      : client;
    if (!billedParty) throw new Error("Committente della fattura non trovato");

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
