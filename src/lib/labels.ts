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

export const invoiceStatusLabels: Record<string, string> = {
  draft: "Bozza",
  issued: "Emessa",
  paid: "Pagata",
  overdue: "Insoluta",
};

export const invoiceStatusVariant: Record<
  string,
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
  company: "Azienda",
};

export const clientDisplayName = (c: {
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
}): string => {
  if (c.kind === "company") return c.business_name || "—";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
};
