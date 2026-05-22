import { formatCurrency } from "@/lib/format";
import type { CaseTimelineActivity, CaseTimelineInvoice } from "@/lib/case-timeline";

export type CaseWorkflowCase = {
  status: string;
  principal_id?: string | null;
  client_id?: string | null;
  counterparty_id?: string | null;
};

export type CaseWorkflowActivity = Pick<
  CaseTimelineActivity,
  "status" | "kind" | "amount" | "needs_review"
> & {
  activity_attachments?: unknown[];
};

export type CaseWorkflowInvoice = Pick<CaseTimelineInvoice, "status" | "due_date" | "total_amount">;

export type CaseWorkflowQualityCheck = {
  severity: "warning" | "ok";
  id?: string;
  title?: string;
  description?: string;
};

export type CaseWorkflowPriorityInsight = {
  title: string;
  description: string;
  items: string[];
  nextStep: string;
};

export type CaseDebtCollectionWorkflow = {
  stage: string;
  priority: "Alta" | "Media" | "Ordinaria";
  priorityVariant: "destructive" | "outline" | "secondary";
  action: string;
  reason: string;
  priorityInsight?: CaseWorkflowPriorityInsight;
};

export function summarizeCaseOperations(
  activities: CaseWorkflowActivity[],
  invoices: CaseWorkflowInvoice[],
) {
  const activityTotals = activities.reduce(
    (acc, activity) => {
      const amount = Number(activity.amount) || 0;
      if (activity.status === "to_invoice") acc.toInvoice += amount;
      if (activity.kind === "fee") acc.fees += amount;
      else acc.reimbursements += amount;
      acc.attachments += activity.activity_attachments?.length ?? 0;
      if ((activity.activity_attachments?.length ?? 0) === 0) acc.activitiesWithoutAttachments += 1;
      if (activity.needs_review) acc.activitiesToReview += 1;
      return acc;
    },
    {
      toInvoice: 0,
      fees: 0,
      reimbursements: 0,
      attachments: 0,
      activitiesWithoutAttachments: 0,
      activitiesToReview: 0,
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
  activities: CaseWorkflowActivity[];
  invoices: CaseWorkflowInvoice[];
  totals: ReturnType<typeof summarizeCaseOperations>;
  qualityChecks: CaseWorkflowQualityCheck[];
}): CaseDebtCollectionWorkflow {
  const hasBlockingQualityChecks = qualityChecks.some((check) => check.severity === "warning");
  const hasDraftInvoices = invoices.some((invoice) => invoice.status === "draft");
  const hasIssuedInvoices = invoices.some((invoice) => invoice.status === "issued");
  const overdueInvoices = invoices.filter(isInvoiceOverdue);
  const hasOverdueInvoices = totals.overdueInvoiceTotal > 0 || overdueInvoices.length > 0;

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
    const setupItems = qualityChecks
      .filter((check) => check.severity === "warning")
      .map((check) => check.title)
      .filter((title): title is string => Boolean(title));

    return {
      stage: "Impostazione pratica",
      priority: "Alta",
      priorityVariant: "destructive" as const,
      action: "Completa soggetti e prima Attività.",
      reason: "Mancano dati essenziali per procedere.",
      priorityInsight: {
        title: "Perché richiede intervento",
        description:
          "Pratix richiede intervento perché la pratica è ancora in impostazione e non ha una base operativa completa.",
        items: setupItems.length > 0 ? setupItems : ["Dati essenziali incompleti"],
        nextStep: "Completa soggetti e prima Attività.",
      } satisfies CaseWorkflowPriorityInsight,
    };
  }

  if (hasOverdueInvoices) {
    const overdueAmount = totals.overdueInvoiceTotal || totals.openInvoiceTotal;

    return {
      stage: "Recupero incasso",
      priority: "Alta",
      priorityVariant: "destructive" as const,
      action: "Sollecita il pagamento delle Fatture insolute.",
      reason: `${formatCurrency(overdueAmount)} risultano ancora aperti.`,
      priorityInsight: {
        title: "Perché richiede intervento",
        description:
          "Pratix richiede intervento perché ci sono Fatture scadute o già segnate come insolute.",
        items: [
          `${formatCurrency(overdueAmount)} ancora aperti`,
          overdueInvoices.length > 0
            ? formatCount(overdueInvoices.length, "Fattura insoluta", "Fatture insolute")
            : "Fatture aperte oltre la scadenza",
        ],
        nextStep: "Sollecita il pagamento delle Fatture insolute.",
      } satisfies CaseWorkflowPriorityInsight,
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
    const toInvoiceActivities = activities.filter((activity) => activity.status === "to_invoice");

    return {
      stage: "Preparazione Fattura",
      priority: "Alta",
      priorityVariant: "destructive" as const,
      action: "Prepara la Fattura per le Attività maturate.",
      reason: `${formatCurrency(totals.toInvoice)} sono da fatturare.`,
      priorityInsight: {
        title: "Perché richiede intervento",
        description:
          "Pratix richiede intervento perché ci sono Attività maturate non ancora collegate a una Fattura.",
        items: [
          `${formatCurrency(totals.toInvoice)} da fatturare`,
          formatCount(
            toInvoiceActivities.length,
            "Attività maturata non fatturata",
            "Attività maturate non fatturate",
          ),
        ],
        nextStep: "Prepara la Fattura per le Attività maturate.",
      } satisfies CaseWorkflowPriorityInsight,
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

export function buildCaseWorkflowQualityChecks({
  caseRow,
  activities,
  invoices,
  totals,
}: {
  caseRow: CaseWorkflowCase;
  activities: CaseWorkflowActivity[];
  invoices: CaseWorkflowInvoice[];
  totals: ReturnType<typeof summarizeCaseOperations>;
}) {
  const checks: CaseWorkflowQualityCheck[] = [];

  if (!caseRow.principal_id) {
    checks.push({
      id: "missing-principal",
      severity: "warning",
      title: "Committente mancante",
      description: "Completa il soggetto fatturato prima di preparare nuove Fatture.",
    });
  }
  if (!caseRow.client_id) {
    checks.push({
      id: "missing-client",
      severity: "warning",
      title: "Cliente mancante",
      description: "Completa il Cliente per mantenere coerente la pratica.",
    });
  }
  if (!caseRow.counterparty_id) {
    checks.push({
      id: "missing-counterparty",
      severity: "warning",
      title: "Controparte mancante",
      description: "Aggiungi la Controparte per rendere completo il dossier.",
    });
  }
  if (activities.length === 0) {
    checks.push({
      id: "missing-activities",
      severity: "warning",
      title: "Nessuna Attività",
      description: "Registra almeno un Compenso o Rimborso spese se la pratica ha lavoro storico.",
    });
  }
  if (totals.toInvoice > 0) {
    checks.push({
      id: "to-invoice",
      severity: "warning",
      title: "Attività da fatturare",
      description: `${formatCurrency(totals.toInvoice)} non ancora collegati a una Fattura.`,
    });
  }
  if (totals.activitiesToReview > 0) {
    checks.push({
      id: "activities-to-review",
      severity: "warning",
      title: "Importi da verificare",
      description: `${totals.activitiesToReview} Attività hanno importi segnati da verificare.`,
    });
  }
  if (totals.activitiesWithoutAttachments > 0) {
    checks.push({
      id: "missing-attachments",
      severity: "warning",
      title: "Attività senza allegati",
      description: `${totals.activitiesWithoutAttachments} Attività non hanno allegati collegati.`,
    });
  }

  const draftInvoices = invoices.filter((invoice) => invoice.status === "draft").length;
  if (draftInvoices > 0) {
    checks.push({
      id: "draft-invoices",
      severity: "warning",
      title: "Fatture in bozza",
      description: `${draftInvoices} Fatture sono ancora da completare o emettere.`,
    });
  }

  if (checks.length === 0) {
    checks.push({
      id: "ok",
      severity: "ok",
      title: "Dati principali completi",
      description: "La pratica non presenta avvisi operativi immediati.",
    });
  }

  return checks;
}

export function formatCaseWorkflowPriorityLabel(priority: string) {
  if (priority === "Alta") return "Richiede intervento";
  if (priority === "Media") return "Da monitorare";
  if (priority === "Ordinaria") return "Regolare";
  return priority;
}

function amountOf(invoice: CaseWorkflowInvoice) {
  return Number(invoice.total_amount) || 0;
}

function isInvoiceOverdue(invoice: CaseWorkflowInvoice) {
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

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
