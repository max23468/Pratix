import type { BillingExportKind, BillingExportRow } from "@/lib/billing-xlsx";
import type { InvoiceLineInput } from "@/lib/invoice-calc";
import type { InvoiceLineKind } from "@/lib/invoice-calc";
import {
  billingDatePattern,
  billingCounterpartyName,
  billingPartyName,
  nextBillingPeriodStart,
  type BillingPartyDisplay,
} from "@/server/invoice-billing.helpers";

export type BillingItemStatus = "included" | "postponed" | "excluded";

export type BillingSelectionInput = {
  activityId: string;
  status: BillingItemStatus;
  notes?: string | null;
};

export type CreateBillingInvoiceInput = {
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

export type UpdateDraftBillingInvoiceInput = CreateBillingInvoiceInput & {
  invoiceId: string;
};

export type BillingActivity = {
  id: string;
  case_id: string | null;
  client_id: string | null;
  activity_date: string;
  kind: "fee" | "expense_reimbursement";
  status: "to_invoice" | "invoiced";
  needs_review?: boolean | null;
  invoice_id: string | null;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  amount: number | string;
  postponed_count?: number | string | null;
  cases?: { practice_number: number | null } | null;
  clients?: BillingPartyDisplay | null;
  counterparties?: BillingPartyDisplay | null;
  case_activity_hearings?: Array<{ hearing_date: string; position: number | string }> | null;
};

export type BillingInvoiceLine = {
  case_activity_id?: string | null;
  practice_number: number | null;
  client_name: string | null;
  counterparty_name: string | null;
  activity_date: string;
  kind: InvoiceLineKind;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  amount: number | string;
  case_activity_hearings?: Array<{ hearing_date: string; position: number | string }> | null;
};

export type BillingTotals = {
  taxableFees: number;
  taxableExpenses: number;
  art15Expenses: number;
  generalExpensesAmount: number;
  cassaBaseAmount: number;
  cassaAmount: number;
  vatAmount: number;
  withholdingAmount: number;
  stampAmount: number;
  totalAmount: number;
  netToPay: number;
};

export type InvoiceXmlPrincipal = {
  business_name: string | null;
  tax_code: string | null;
  vat_number: string | null;
  sdi_code: string | null;
  pec: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  address_province: string | null;
  address_country: string | null;
};

export function validateCreateBillingInvoiceInput(input: CreateBillingInvoiceInput) {
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
}

export function validateUpdateDraftBillingInvoiceInput(input: UpdateDraftBillingInvoiceInput) {
  if (!input?.invoiceId) throw new Error("Fattura mancante");
  return validateCreateBillingInvoiceInput(input);
}

export function selectedActivityIds(selections: BillingSelectionInput[]) {
  return selections.map((selection) => selection.activityId);
}

export function selectionMap(selections: BillingSelectionInput[]) {
  return new Map(selections.map((selection) => [selection.activityId, selection]));
}

export function partitionBillingActivities(
  activities: BillingActivity[],
  selections: Map<string, BillingSelectionInput>,
) {
  return {
    included: activities.filter((activity) => selections.get(activity.id)?.status === "included"),
    postponed: activities.filter((activity) => selections.get(activity.id)?.status === "postponed"),
  };
}

export function firstIncludedClientId(included: BillingActivity[]) {
  const firstIncluded = included[0];
  if (!firstIncluded?.client_id) {
    throw new Error("Le attività incluse devono avere un cliente collegato");
  }
  return firstIncluded.client_id;
}

export function assertIncludedActivitiesBillable(included: BillingActivity[]) {
  for (const activity of included) {
    if (activity.status !== "to_invoice" || activity.invoice_id) {
      throw new Error("Una o più attività incluse risultano già fatturate");
    }
  }
}

export function assertIncludedActivitiesEditable(included: BillingActivity[], invoiceId: string) {
  for (const activity of included) {
    const alreadyInCurrentDraft = activity.invoice_id === invoiceId;
    const stillBillable = activity.status === "to_invoice" && !activity.invoice_id;
    if (!alreadyInCurrentDraft && !stillBillable) {
      throw new Error("Una o più attività incluse risultano già fatturate");
    }
  }
}

export function invoiceLinesForTotals(included: BillingActivity[]): InvoiceLineInput[] {
  return included.map((activity) => ({
    kind: activity.kind === "fee" ? "fee" : "expense_art15",
    quantity: Number(activity.quantity),
    unit_price: Number(activity.unit_price),
  }));
}

export function buildBillingRunRow({
  input,
  userId,
  totals,
}: {
  input: CreateBillingInvoiceInput;
  userId: string;
  totals: BillingTotals;
}) {
  return {
    user_id: userId,
    principal_id: input.principalId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    status: "finalized" as const,
    include_general_expenses: input.includeGeneralExpenses,
    general_expenses_rate: input.generalExpensesRate,
    compensation_total: totals.taxableFees,
    general_expenses_amount: totals.generalExpensesAmount,
    cassa_rate: input.cassaRate,
    cassa_base_amount: totals.cassaBaseAmount,
    cassa_amount: totals.cassaAmount,
    reimbursements_total: totals.art15Expenses,
    notes: input.notes?.trim() || null,
  };
}

export function buildInvoiceRow({
  input,
  userId,
  billingRunId,
  firstIncluded,
  number,
  year,
  totals,
}: {
  input: CreateBillingInvoiceInput;
  userId: string;
  billingRunId: string;
  firstIncluded: BillingActivity;
  number: string;
  year: number;
  totals: BillingTotals;
}) {
  return {
    user_id: userId,
    client_id: firstIncluded.client_id,
    case_id: firstIncluded.case_id,
    principal_id: input.principalId,
    billing_run_id: billingRunId,
    number,
    year,
    issue_date: input.issueDate,
    due_date: input.dueDate || null,
    status: input.status,
    cassa_rate: input.cassaRate,
    vat_rate: input.vatRate,
    withholding_rate: input.withholdingRate,
    apply_withholding: input.applyWithholding,
    taxable_fees: totals.taxableFees,
    taxable_expenses: totals.taxableExpenses,
    art15_expenses: totals.art15Expenses,
    general_expenses_amount: totals.generalExpensesAmount,
    general_expenses_rate: input.generalExpensesRate,
    include_general_expenses: input.includeGeneralExpenses,
    cassa_base_amount: totals.cassaBaseAmount,
    cassa_amount: totals.cassaAmount,
    vat_amount: totals.vatAmount,
    withholding_amount: totals.withholdingAmount,
    stamp_amount: totals.stampAmount,
    total_amount: totals.totalAmount,
    net_to_pay: totals.netToPay,
    payment_method: input.paymentMethod?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export function buildInvoiceUpdateRow({
  input,
  firstIncluded,
  totals,
}: {
  input: CreateBillingInvoiceInput;
  firstIncluded: BillingActivity;
  totals: BillingTotals;
}) {
  return {
    client_id: firstIncluded.client_id,
    case_id: firstIncluded.case_id,
    principal_id: input.principalId,
    issue_date: input.issueDate,
    due_date: input.dueDate || null,
    status: input.status,
    paid_at: null,
    cassa_rate: input.cassaRate,
    vat_rate: input.vatRate,
    withholding_rate: input.withholdingRate,
    apply_withholding: input.applyWithholding,
    taxable_fees: totals.taxableFees,
    taxable_expenses: totals.taxableExpenses,
    art15_expenses: totals.art15Expenses,
    general_expenses_amount: totals.generalExpensesAmount,
    general_expenses_rate: input.generalExpensesRate,
    include_general_expenses: input.includeGeneralExpenses,
    cassa_base_amount: totals.cassaBaseAmount,
    cassa_amount: totals.cassaAmount,
    vat_amount: totals.vatAmount,
    withholding_amount: totals.withholdingAmount,
    stamp_amount: totals.stampAmount,
    total_amount: totals.totalAmount,
    net_to_pay: totals.netToPay,
    payment_method: input.paymentMethod?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export function buildInvoiceLineRows({
  input,
  userId,
  invoiceId,
  included,
  totals,
}: {
  input: CreateBillingInvoiceInput;
  userId: string;
  invoiceId: string;
  included: BillingActivity[];
  totals: BillingTotals;
}) {
  const invoiceLineRows = included.map((activity, index) => ({
    user_id: userId,
    invoice_id: invoiceId,
    position: index + 1,
    case_activity_id: activity.id,
    practice_number: activity.cases?.practice_number ?? null,
    client_name: billingPartyName(activity.clients),
    counterparty_name: billingCounterpartyName(activity.counterparties),
    activity_date: activity.activity_date,
    kind: (activity.kind === "fee" ? "fee" : "expense_art15") as InvoiceLineKind,
    description: activity.description,
    quantity: Number(activity.quantity),
    unit_price: Number(activity.unit_price),
    amount: Number(activity.amount),
  }));

  if (totals.generalExpensesAmount > 0) {
    invoiceLineRows.push({
      user_id: userId,
      invoice_id: invoiceId,
      position: invoiceLineRows.length + 1,
      case_activity_id: null,
      practice_number: null,
      client_name: null,
      counterparty_name: null,
      activity_date: input.issueDate,
      kind: "fee",
      description: `Spese generali ${input.generalExpensesRate}%`,
      quantity: 1,
      unit_price: totals.generalExpensesAmount,
      amount: totals.generalExpensesAmount,
    });
  }

  return invoiceLineRows;
}

export function buildBillingRunItemRows({
  activities,
  billingRunId,
  selections,
  userId,
}: {
  activities: BillingActivity[];
  billingRunId: string;
  selections: Map<string, BillingSelectionInput>;
  userId: string;
}) {
  return activities.map((activity) => {
    const selection = selections.get(activity.id);
    return {
      user_id: userId,
      billing_run_id: billingRunId,
      activity_id: activity.id,
      status: selection?.status ?? "excluded",
      notes: selection?.notes?.trim() || null,
    };
  });
}

export function postponedActivityUpdate(activity: BillingActivity, periodEnd: string) {
  return {
    id: activity.id,
    postponed_until: nextBillingPeriodStart(periodEnd),
    postponed_count: Number(activity.postponed_count ?? 0) + 1,
  };
}

export function draftPostponedActivityUpdate({
  activity,
  periodEnd,
  previousStatus,
}: {
  activity: BillingActivity;
  periodEnd: string;
  previousStatus?: BillingItemStatus;
}) {
  const update = postponedActivityUpdate(activity, periodEnd);
  return previousStatus === "postponed"
    ? {
        ...update,
        postponed_count: Number(activity.postponed_count ?? 0),
      }
    : update;
}

export function buildBillingExportRows(
  included: BillingActivity[],
  kind: "fee" | "expense_reimbursement",
): BillingExportRow[] {
  return included
    .filter((activity) => activity.kind === kind)
    .map((activity) => ({
      practiceNumber: activity.cases?.practice_number ?? null,
      clientName: billingPartyName(activity.clients),
      counterpartyName: billingCounterpartyName(activity.counterparties),
      activityDate: activity.activity_date,
      description: activity.description,
      quantity: Number(activity.quantity),
      unitPrice: Number(activity.unit_price),
      amount: Number(activity.amount),
      hearingDates: (activity.case_activity_hearings ?? [])
        .slice()
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((hearing) => hearing.hearing_date),
    }));
}

export function buildBillingExportRowsFromInvoiceLines(
  lines: BillingInvoiceLine[],
  kind: BillingExportKind,
): BillingExportRow[] {
  const lineKind: InvoiceLineKind = kind === "fees" ? "fee" : "expense_art15";
  return lines
    .filter((line) => line.kind === lineKind)
    .map((line) => ({
      practiceNumber: line.practice_number,
      clientName: line.client_name ?? "",
      counterpartyName: line.counterparty_name ?? "",
      activityDate: line.activity_date,
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unit_price),
      amount: Number(line.amount),
      hearingDates: (line.case_activity_hearings ?? [])
        .slice()
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((hearing) => hearing.hearing_date),
    }));
}

export function billedPartyForInvoiceXml(principal: InvoiceXmlPrincipal | null) {
  if (!principal) throw new Error("Committente della fattura non trovato");

  return {
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
  };
}
