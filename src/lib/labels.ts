/** Etichette italiane per gli enum del database. */

export const caseStatusLabels: Record<string, string> = {
  open: "Aperta",
  in_progress: "In corso",
  suspended: "Sospesa",
  closed: "Chiusa",
  archived: "Archiviata",
};

export const caseStatusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open: "default",
  in_progress: "default",
  suspended: "outline",
  closed: "secondary",
  archived: "secondary",
};

export type PracticeDisplayData = {
  practice_number?: number | null;
};

export const practiceDisplayName = (practice: PracticeDisplayData): string => {
  const practiceNumber = practice.practice_number ?? "-";
  return `Pratica ${practiceNumber}`;
};

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue";

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Bozza",
  issued: "Emessa",
  paid: "Pagata",
  overdue: "Insoluta",
};

export const invoiceStatusVariant: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  issued: "default",
  paid: "secondary",
  overdue: "destructive",
};

export const taxRegimeLabels: Record<string, string> = {
  ordinario: "Ordinario",
  forfettario: "Forfettario",
};

export const clientKindLabels: Record<string, string> = {
  individual: "Privato",
  company: "Società",
};

export const counterpartyKindLabels: Record<string, string> = {
  individual: "Persona fisica",
  company: "Società",
  group: "Composta",
};

export const priceBookStatusLabels: Record<string, string> = {
  draft: "Bozza",
  active: "Attivo",
  archived: "Archiviato",
};

export const priceBookStatusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
};

export const priceItemKindLabels: Record<string, string> = {
  fee: "Compenso",
  expense_reimbursement: "Rimborso spese",
};

export const caseActivityStatusLabels: Record<string, string> = {
  to_invoice: "Da fatturare",
  invoiced: "Fatturata",
};

export const caseActivityDisplayStatusLabels: Record<string, string> = {
  ...caseActivityStatusLabels,
  draft_invoice: "In bozza",
};

export const caseActivityStatusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  to_invoice: "outline",
  invoiced: "secondary",
};

export const caseActivityDisplayStatusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ...caseActivityStatusVariant,
  draft_invoice: "outline",
};

export function caseActivityDisplayStatus(activity: {
  status: string;
  invoice_id?: string | null;
}) {
  return activity.status === "to_invoice" && activity.invoice_id
    ? "draft_invoice"
    : activity.status;
}

export type ClientDisplayData = {
  id?: string | null;
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

export const clientDisplayName = (c: ClientDisplayData): string => {
  if (c.kind === "company") return c.business_name || "—";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
};

const clientNameCollator = new Intl.Collator("it", {
  sensitivity: "base",
  numeric: true,
});

const clientSortName = (c: ClientDisplayData): string => {
  if (c.kind === "company") return c.business_name || "";
  return [c.last_name, c.first_name].filter(Boolean).join(" ");
};

export const compareClients = <T extends ClientDisplayData>(a: T, b: T): number => {
  const byName = clientNameCollator.compare(clientSortName(a), clientSortName(b));
  if (byName !== 0) return byName;

  const byKind = clientNameCollator.compare(a.kind, b.kind);
  if (byKind !== 0) return byKind;

  return clientNameCollator.compare(a.id ?? "", b.id ?? "");
};

export type CounterpartyDisplayData = {
  id?: string | null;
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

const counterpartyNameCollator = new Intl.Collator("it", {
  sensitivity: "base",
  numeric: true,
});

export const counterpartyDisplayName = (c: CounterpartyDisplayData): string => {
  if (c.kind === "individual") {
    return [c.last_name, c.first_name].filter(Boolean).join(" ") || "—";
  }

  return c.business_name || "—";
};

export const compareCounterparties = <T extends CounterpartyDisplayData>(a: T, b: T): number => {
  const byName = counterpartyNameCollator.compare(
    counterpartyDisplayName(a),
    counterpartyDisplayName(b),
  );
  if (byName !== 0) return byName;

  const byKind = counterpartyNameCollator.compare(a.kind, b.kind);
  if (byKind !== 0) return byKind;

  return counterpartyNameCollator.compare(a.id ?? "", b.id ?? "");
};
