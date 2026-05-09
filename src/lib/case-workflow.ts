import { formatCurrency } from "@/lib/format";
import type { CaseTimelineActivity, CaseTimelineInvoice } from "@/lib/case-timeline";

export type CaseWorkflowCase = {
  status: string;
};

export type CaseWorkflowQualityCheck = {
  severity: "warning" | "ok";
};

export function summarizeCaseOperations(
  activities: CaseTimelineActivity[],
  invoices: CaseTimelineInvoice[],
) {
  const activityTotals = activities.reduce(
    (acc, activity) => {
      const amount = Number(activity.amount) || 0;
      if (activity.status === "to_invoice") acc.toInvoice += amount;
      if (activity.kind === "fee") acc.fees += amount;
      else acc.reimbursements += amount;
      acc.attachments += activity.activity_attachments?.length ?? 0;
      if ((activity.activity_attachments?.length ?? 0) === 0) acc.activitiesWithoutAttachments += 1;
      return acc;
    },
    {
      toInvoice: 0,
      fees: 0,
      reimbursements: 0,
      attachments: 0,
      activitiesWithoutAttachments: 0,
    },
  );

  const invoiceTotal = invoices.reduce((sum, invoice) => sum + amountOf(invoice), 0);
  const paidTotal = invoices.reduce(
    (sum, invoice) => sum + (invoice.status === "paid" ? amountOf(invoice) : 0),
    0,
  );
  const openInvoiceTotal = invoices.reduce(
    (sum, invoice) => sum + (invoice.status !== "paid" ? amountOf(invoice) : 0),
    0,
  );
  const overdueInvoiceTotal = invoices.reduce(
    (sum, invoice) => sum + (isInvoiceOverdue(invoice) ? amountOf(invoice) : 0),
    0,
  );
  const matured = activityTotals.fees + activityTotals.reimbursements;
  const residual = Math.max(matured - paidTotal, 0);

  return {
    ...activityTotals,
    matured,
    invoiceTotal,
    paidTotal,
    openInvoiceTotal,
    overdueInvoiceTotal,
    residual,
  };
}

export function buildDebtCollectionWorkflow({
  caseRow,
  activities,
  invoices,
  totals,
  qualityChecks,
}: {
  caseRow: CaseWorkflowCase;
  activities: CaseTimelineActivity[];
  invoices: CaseTimelineInvoice[];
  totals: ReturnType<typeof summarizeCaseOperations>;
  qualityChecks: CaseWorkflowQualityCheck[];
}) {
  const hasBlockingQualityChecks = qualityChecks.some((check) => check.severity === "warning");
  const hasDraftInvoices = invoices.some((invoice) => invoice.status === "draft");
  const hasIssuedInvoices = invoices.some((invoice) => invoice.status === "issued");
  const hasOverdueInvoices = totals.overdueInvoiceTotal > 0 || invoices.some(isInvoiceOverdue);

  if (caseRow.status === "closed" || caseRow.status === "archived") {
    return {
      stage: "Chiusura e archivio",
      priority: "Ordinaria",
      priorityVariant: "secondary" as const,
      action: "Scarica dossier e verifica residui.",
      reason: "La pratica non è più operativa.",
    };
  }

  if (hasBlockingQualityChecks && activities.length === 0) {
    return {
      stage: "Impostazione pratica",
      priority: "Alta",
      priorityVariant: "destructive" as const,
      action: "Completa soggetti e prima Attività.",
      reason: "Mancano dati essenziali per procedere.",
    };
  }

  if (hasOverdueInvoices) {
    return {
      stage: "Recupero incasso",
      priority: "Alta",
      priorityVariant: "destructive" as const,
      action: "Sollecita il pagamento delle Fatture insolute.",
      reason: `${formatCurrency(totals.overdueInvoiceTotal || totals.openInvoiceTotal)} risultano ancora aperti.`,
    };
  }

  if (hasIssuedInvoices) {
    return {
      stage: "Monitoraggio incasso",
      priority: "Media",
      priorityVariant: "outline" as const,
      action: "Controlla scadenze e incassi delle Fatture emesse.",
      reason: `${formatCurrency(totals.openInvoiceTotal)} risultano da incassare.`,
    };
  }

  if (hasDraftInvoices) {
    return {
      stage: "Emissione Fattura",
      priority: "Media",
      priorityVariant: "outline" as const,
      action: "Completa o emetti le Fatture in bozza.",
      reason: "Ci sono Fatture preparate ma non ancora emesse.",
    };
  }

  if (totals.toInvoice > 0) {
    return {
      stage: "Preparazione Fattura",
      priority: "Alta",
      priorityVariant: "destructive" as const,
      action: "Prepara la Fattura per le Attività maturate.",
      reason: `${formatCurrency(totals.toInvoice)} sono da fatturare.`,
    };
  }

  if (hasBlockingQualityChecks) {
    return {
      stage: "Completamento dati",
      priority: "Media",
      priorityVariant: "outline" as const,
      action: "Risolvi gli avvisi qualità prima del dossier.",
      reason: "La pratica ha dati operativi da completare.",
    };
  }

  return {
    stage: "Pratica sotto controllo",
    priority: "Ordinaria",
    priorityVariant: "secondary" as const,
    action: "Mantieni aggiornate Attività e Fatture.",
    reason: "Non ci sono avvisi operativi immediati.",
  };
}

function amountOf(invoice: CaseTimelineInvoice) {
  return Number(invoice.total_amount) || 0;
}

function isInvoiceOverdue(invoice: CaseTimelineInvoice) {
  if (invoice.status === "overdue") return true;
  if (invoice.status !== "issued" || !invoice.due_date) return false;
  return dateOnlyKey(invoice.due_date) < todayDateKey();
}

function todayDateKey() {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function dateOnlyKey(value: string) {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (year && month && day) {
    return toDateKey(year, month, day);
  }

  const date = new Date(value);
  return toDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
