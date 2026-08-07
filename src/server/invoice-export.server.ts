import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildBillingWorkbook, type BillingExportKind } from "@/lib/billing-xlsx";
import { buildBillingExportRowsFromInvoiceLines } from "@/server/invoice-billing.logic";

export async function buildStoredBillingExport({
  supabase,
  userId,
  invoiceId,
  kind,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  invoiceId: string;
  kind: BillingExportKind;
}) {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, billing_run_id, principal_id")
    .eq("id", invoiceId)
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
      .eq("kind", kind)
      .maybeSingle(),
  ]);
  if (runError) throw runError;
  if (principalError) throw principalError;
  if (exportReferenceError) throw exportReferenceError;

  const { data: lines, error: linesError } = await supabase
    .from("invoice_lines")
    .select(
      "case_activity_id, practice_number, client_name, counterparty_name, activity_date, hearing_dates, kind, description, quantity, unit_price, amount",
    )
    .eq("user_id", userId)
    .eq("invoice_id", invoice.id)
    .eq("kind", kind === "fees" ? "fee" : "expense_art15")
    .order("position", { ascending: true });
  if (linesError) throw linesError;

  const file = buildBillingWorkbook({
    kind,
    principalName: principal.business_name,
    periodStart: billingRun.period_start,
    periodEnd: billingRun.period_end,
    rows: buildBillingExportRowsFromInvoiceLines(lines ?? [], kind),
  });

  return { exportReference, file };
}
