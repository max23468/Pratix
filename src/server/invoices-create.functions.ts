import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { buildBillingWorkbook, type BillingExportKind } from "@/lib/billing-xlsx";
import { computeInvoice } from "@/lib/invoice-calc";
import { buildBillingExportStoragePath, PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import { nextBillingPeriodStart } from "@/server/invoice-billing.helpers";
import {
  assertIncludedActivitiesEditable,
  buildBillingExportRows,
  buildBillingRunItemRows,
  buildInvoiceLineRows,
  firstIncludedClientId,
  invoiceLinesForTotals,
  partitionBillingActivities,
  selectedActivityIds,
  selectionMap,
  validateCreateBillingInvoiceInput,
  validateUpdateDraftBillingInvoiceInput,
  type BillingActivity,
  type CreateBillingInvoiceInput,
} from "@/server/invoice-billing.logic";
import { buildStoredBillingExport } from "@/server/invoice-export.server";

type BillingExportReference = {
  id: string;
  kind: BillingExportKind;
  file_name: string;
  storage_path: string;
  storage_status: "pending" | "ready";
};

type SaveBillingInvoiceResult = {
  invoiceId: string;
  invoiceRef: string;
  billingRunId: string;
  number: string;
  year: number;
  exports: BillingExportReference[];
};

type CreateBillingInvoiceRequest = CreateBillingInvoiceInput & { requestId: string };

type BillingExportFile = ReturnType<typeof buildExportFiles>[number];

const validateRequestId = (requestId: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    throw new Error("Richiesta fattura non valida");
  }
};

const validateCreateBillingInvoiceRequest = (input: CreateBillingInvoiceRequest) => {
  validateCreateBillingInvoiceInput(input);
  validateRequestId(input.requestId);
  return input;
};

const validateUpdateDraftBillingInvoiceRequest = (
  input: CreateBillingInvoiceRequest & { invoiceId: string },
) => {
  validateUpdateDraftBillingInvoiceInput(input);
  validateRequestId(input.requestId);
  return input;
};

function buildExportFiles({
  principalName,
  periodStart,
  periodEnd,
  included,
}: {
  principalName: string;
  periodStart: string;
  periodEnd: string;
  included: BillingActivity[];
}) {
  return (["fees", "expenses"] as const).map((kind) => ({
    kind,
    ...buildBillingWorkbook({
      kind,
      principalName,
      periodStart,
      periodEnd,
      rows: buildBillingExportRows(included, kind === "fees" ? "fee" : "expense_reimbursement"),
    }),
  }));
}

async function uploadBillingExports({
  supabase,
  userId,
  references,
  files,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  references: BillingExportReference[];
  files: BillingExportFile[];
}) {
  const attempts = await Promise.allSettled(
    files.map(async (file) => {
      const reference = references.find((item) => item.kind === file.kind);
      if (!reference) throw new Error(`Rendiconto ${file.kind} non registrato`);

      const { error: uploadError } = await supabase.storage
        .from(PRATIX_DOCUMENTS_BUCKET)
        .upload(reference.storage_path, Buffer.from(file.bytes), {
          contentType: file.mimeType,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { error: readyError } = await supabase
        .from("billing_exports")
        .update({
          storage_status: "ready",
          mime_type: file.mimeType,
          size_bytes: file.bytes.byteLength,
          generated_at: new Date().toISOString(),
        })
        .eq("id", reference.id)
        .eq("user_id", userId);
      if (readyError) throw readyError;
    }),
  );

  const failed = attempts.find((attempt) => attempt.status === "rejected");
  if (failed?.status === "rejected") {
    throw new Error(
      "Fattura salvata. Un rendiconto non è stato completato: riprova per recuperarlo.",
      { cause: failed.reason },
    );
  }
}

async function findRecoverableInvoice({
  supabase,
  userId,
  requestId,
  invoiceId,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  requestId: string;
  invoiceId: string | null;
}): Promise<SaveBillingInvoiceResult | null> {
  let savedInvoiceId = invoiceId;
  let billingRunId: string | null = null;

  if (!savedInvoiceId) {
    const { data: run, error: runError } = await supabase
      .from("billing_runs")
      .select("id, invoice_id")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run?.invoice_id) return null;
    savedInvoiceId = run.invoice_id;
    billingRunId = run.id;
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, public_code, billing_run_id, number, year")
    .eq("id", savedInvoiceId)
    .eq("user_id", userId)
    .single();
  if (invoiceError) throw invoiceError;
  if (!invoice?.billing_run_id) return null;
  billingRunId ??= invoice.billing_run_id;

  if (invoiceId) {
    const { data: matchingRun, error: runError } = await supabase
      .from("billing_runs")
      .select("id")
      .eq("id", billingRunId)
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .maybeSingle();
    if (runError) throw runError;
    if (!matchingRun) return null;
  }

  const { data: exports, error: exportsError } = await supabase
    .from("billing_exports")
    .select("id, kind, file_name, storage_path, storage_status")
    .eq("billing_run_id", billingRunId)
    .eq("user_id", userId)
    .order("kind", { ascending: true });
  if (exportsError) throw exportsError;

  const references = (exports ?? []) as BillingExportReference[];
  if (
    references.length !== 2 ||
    !references.some((item) => item.kind === "fees") ||
    !references.some((item) => item.kind === "expenses")
  ) {
    throw new Error("Riferimenti Storage della fattura incompleti");
  }
  return {
    invoiceId: invoice.id,
    invoiceRef: invoice.public_code ?? invoice.id,
    billingRunId,
    number: invoice.number,
    year: invoice.year,
    exports: references,
  };
}

async function recoverBillingExports({
  supabase,
  userId,
  saved,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  saved: SaveBillingInvoiceResult;
}) {
  const files = await Promise.all(
    saved.exports.map(async ({ kind }) => ({
      kind,
      ...(
        await buildStoredBillingExport({
          supabase,
          userId,
          invoiceId: saved.invoiceId,
          kind,
        })
      ).file,
    })),
  );
  await uploadBillingExports({ supabase, userId, references: saved.exports, files });
  return {
    ...saved,
    exports: saved.exports.map((item) => ({ ...item, storage_status: "ready" as const })),
  };
}

async function saveBillingInvoice({
  input,
  invoiceId,
  supabase,
  userId,
}: {
  input: CreateBillingInvoiceRequest;
  invoiceId: string | null;
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  const recoverable = await findRecoverableInvoice({
    supabase,
    userId,
    requestId: input.requestId,
    invoiceId,
  });
  if (recoverable) return recoverBillingExports({ supabase, userId, saved: recoverable });

  const selectedIds = selectedActivityIds(input.selections);
  const selectionById = selectionMap(input.selections);

  const [{ data: principal, error: principalError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("principals")
        .select("id, business_name")
        .eq("id", input.principalId)
        .eq("user_id", userId)
        .single(),
      supabase.from("profiles").select("tax_regime, include_stamp_duty").eq("id", userId).single(),
    ]);
  if (principalError) throw principalError;
  if (profileError) throw profileError;
  if (!principal) throw new Error("Committente non trovato");

  const { data: activities, error: activitiesError } = await supabase
    .from("case_activities")
    .select(
      "id, case_id, principal_id, client_id, counterparty_id, activity_date, kind, status, invoice_id, description, quantity, unit_price, amount, postponed_count, postponed_until, cases(practice_number), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name), case_activity_hearings(hearing_date, position)",
    )
    .eq("user_id", userId)
    .eq("principal_id", input.principalId)
    .in("id", selectedIds);
  if (activitiesError) throw activitiesError;
  if (!activities || activities.length !== selectedIds.length) {
    throw new Error("Una o più attività non sono disponibili");
  }

  const billingActivities = activities as BillingActivity[];
  const { included } = partitionBillingActivities(billingActivities, selectionById);
  const firstIncluded = included[0];
  firstIncludedClientId(included);
  if (invoiceId) assertIncludedActivitiesEditable(included, invoiceId);

  const totals = computeInvoice(invoiceLinesForTotals(included), {
    cassaRate: Number(input.cassaRate),
    vatRate: Number(input.vatRate),
    withholdingRate: Number(input.withholdingRate),
    applyWithholding: input.applyWithholding,
    taxRegime: profile.tax_regime === "forfettario" ? "forfettario" : "ordinario",
    includeGeneralExpenses: input.includeGeneralExpenses,
    generalExpensesRate: Number(input.generalExpensesRate),
    includeStampDuty: Boolean(profile.include_stamp_duty),
  });

  const files = buildExportFiles({
    principalName: principal.business_name,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    included,
  });
  const fallbackRunId = input.requestId;
  const lineRows = buildInvoiceLineRows({
    input,
    userId,
    invoiceId: invoiceId ?? input.requestId,
    included,
    totals,
  }).map(({ user_id: _userId, invoice_id: _invoiceId, ...line }) => line);
  const itemRows = buildBillingRunItemRows({
    activities: billingActivities,
    billingRunId: fallbackRunId,
    selections: selectionById,
    userId,
  }).map(({ user_id: _userId, billing_run_id: _billingRunId, ...item }) => item);
  const exportRows = files.map((file) => ({
    kind: file.kind,
    storage_path: buildBillingExportStoragePath(userId, fallbackRunId, file.fileName),
    file_name: file.fileName,
    mime_type: file.mimeType,
    size_bytes: file.bytes.byteLength,
  }));

  const rpcArgs = {
    p_request_id: input.requestId,
    p_invoice_id: invoiceId,
    p_principal_id: input.principalId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_issue_date: input.issueDate,
    p_due_date: input.dueDate || null,
    p_status: input.status,
    p_include_general_expenses: input.includeGeneralExpenses,
    p_general_expenses_rate: input.generalExpensesRate,
    p_compensation_total: totals.taxableFees,
    p_general_expenses_amount: totals.generalExpensesAmount,
    p_cassa_rate: input.cassaRate,
    p_cassa_base_amount: totals.cassaBaseAmount,
    p_cassa_amount: totals.cassaAmount,
    p_reimbursements_total: totals.art15Expenses,
    p_vat_rate: input.vatRate,
    p_withholding_rate: input.withholdingRate,
    p_apply_withholding: input.applyWithholding,
    p_vat_amount: totals.vatAmount,
    p_withholding_amount: totals.withholdingAmount,
    p_stamp_amount: totals.stampAmount,
    p_total_amount: totals.totalAmount,
    p_net_to_pay: totals.netToPay,
    p_payment_method: input.paymentMethod?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_client_id: firstIncluded.client_id,
    p_case_id: firstIncluded.case_id,
    p_postponed_until: nextBillingPeriodStart(input.periodEnd),
    p_lines: lineRows,
    p_items: itemRows,
    p_exports: exportRows,
  } as unknown as Database["public"]["Functions"]["save_billing_invoice"]["Args"];
  const { data: result, error } = await supabase.rpc("save_billing_invoice", rpcArgs);
  if (error) throw error;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Risposta fattura non valida");
  }

  const saved = result as unknown as SaveBillingInvoiceResult;
  await uploadBillingExports({
    supabase,
    userId,
    references: saved.exports,
    files,
  });
  return {
    ...saved,
    exports: saved.exports.map((item) => ({ ...item, storage_status: "ready" as const })),
  };
}

export const createBillingInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateCreateBillingInvoiceRequest)
  .handler(({ data, context }) => saveBillingInvoice({ input: data, invoiceId: null, ...context }));

export const updateDraftBillingInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateUpdateDraftBillingInvoiceRequest)
  .handler(({ data, context }) =>
    saveBillingInvoice({ input: data, invoiceId: data.invoiceId, ...context }),
  );
