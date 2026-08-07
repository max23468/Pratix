import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildBillingWorkbook, type BillingExportKind } from "@/lib/billing-xlsx";
import { buildInvoiceXml } from "@/lib/invoice-xml";
import { PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import {
  billedPartyForInvoiceXml,
  buildBillingExportRowsFromInvoiceLines,
  type InvoiceXmlPrincipal,
} from "@/server/invoice-billing.logic";

export const generateBillingExportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { invoiceId: string; kind: BillingExportKind }) => {
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

    const [
      { data: billingRun, error: runError },
      { data: principal, error: principalError },
      { data: exportReference, error: exportReferenceError },
    ] = await Promise.all([
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
      supabase
        .from("billing_exports")
        .select("id, storage_path")
        .eq("billing_run_id", invoice.billing_run_id)
        .eq("user_id", userId)
        .eq("kind", data.kind)
        .maybeSingle(),
    ]);
    if (runError) throw runError;
    if (principalError) throw principalError;
    if (exportReferenceError) throw exportReferenceError;

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
      ...new Set(
        (lines ?? []).flatMap((line) => (line.case_activity_id ? [line.case_activity_id] : [])),
      ),
    ];
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
      principalName: principal.business_name,
      periodStart: billingRun.period_start,
      periodEnd: billingRun.period_end,
      rows: buildBillingExportRowsFromInvoiceLines(linesWithHearings, data.kind),
    });

    if (exportReference) {
      const { error: uploadError } = await supabase.storage
        .from(PRATIX_DOCUMENTS_BUCKET)
        .upload(exportReference.storage_path, Buffer.from(file.bytes), {
          contentType: file.mimeType,
          upsert: true,
        });
      if (!uploadError) {
        await supabase
          .from("billing_exports")
          .update({
            storage_status: "ready",
            mime_type: file.mimeType,
            size_bytes: file.bytes.byteLength,
            generated_at: new Date().toISOString(),
          })
          .eq("id", exportReference.id)
          .eq("user_id", userId);
      }
    }

    return {
      bytesBase64: Buffer.from(file.bytes).toString("base64"),
      fileName: file.fileName,
      mimeType: file.mimeType,
    };
  });

/** Genera l'XML FatturaPA 1.2.2 per una fattura esistente. */
export const generateInvoiceXmlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { invoiceId: string }) => {
    if (!input?.invoiceId || typeof input.invoiceId !== "string") {
      throw new Error("invoiceId mancante");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: invoice, error: invoiceError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("invoices")
          .select("*")
          .eq("id", data.invoiceId)
          .eq("user_id", userId)
          .single(),
        supabase.from("profiles").select("*").eq("id", userId).single(),
      ]);
    if (invoiceError) throw invoiceError;
    if (profileError) throw profileError;
    if (!invoice) throw new Error("Fattura non trovata");

    const [{ data: lines, error: linesError }, { data: principal, error: principalError }] =
      await Promise.all([
        supabase
          .from("invoice_lines")
          .select("*")
          .eq("invoice_id", invoice.id)
          .order("position", { ascending: true }),
        invoice.principal_id
          ? supabase.from("principals").select("*").eq("id", invoice.principal_id).single()
          : Promise.resolve({ data: null, error: null }),
      ]);
    if (linesError) throw linesError;
    if (principalError) throw principalError;
    const billedParty = billedPartyForInvoiceXml(principal as InvoiceXmlPrincipal | null);

    return buildInvoiceXml({
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
        art15_expenses: Number(invoice.art15_expenses),
        general_expenses_amount: Number(invoice.general_expenses_amount),
        cassa_base_amount: Number(invoice.cassa_base_amount),
        cassa_amount: Number(invoice.cassa_amount),
        vat_amount: Number(invoice.vat_amount),
        withholding_amount: Number(invoice.withholding_amount),
        stamp_amount: Number(invoice.stamp_amount),
        total_amount: Number(invoice.total_amount),
      },
      lines: (lines ?? []).map((line) => ({
        kind: line.kind as "fee" | "expense_art15",
        description: line.description,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        amount: Number(line.amount),
      })),
      client: billedParty,
      profile: {
        business_name: profile.business_name,
        full_name: profile.full_name,
        vat_number: profile.vat_number,
        tax_code: profile.tax_code,
        address_street: profile.address_street,
        address_zip: profile.address_zip,
        address_city: profile.address_city,
        address_province: profile.address_province,
        address_country: profile.address_country,
        tax_regime: profile.tax_regime,
      },
    });
  });
