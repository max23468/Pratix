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

export const caseMatterLabels: Record<string, string> = {
  civile: "Civile",
  penale: "Penale",
  lavoro: "Lavoro",
  famiglia: "Famiglia",
  amministrativo: "Amministrativo",
  tributario: "Tributario",
  commerciale: "Commerciale",
  altro: "Altro",
};

export const expenseCategoryLabels: Record<string, string> = {
  contributo_unificato: "Contributo unificato",
  marche_da_bollo: "Marche da bollo",
  copie: "Copie",
  trasferte: "Trasferte",
  ctu: "CTU",
  notifiche: "Notifiche",
  altro: "Altro",
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

export type ClientDisplayData = {
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

export const clientDisplayName = (c: ClientDisplayData): string => {
  if (c.kind === "company") return c.business_name || "—";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
};

export type CounterpartyDisplayData = {
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

export const counterpartyDisplayName = (c: CounterpartyDisplayData): string => {
  if (c.kind === "individual") {
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
  }

  return c.business_name || "—";
};
