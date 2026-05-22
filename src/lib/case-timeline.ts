import { formatDate } from "@/lib/format";
import {
  caseActivityStatusLabels,
  caseStatusLabels,
  clientDisplayName,
  invoiceStatusLabels,
  priceItemKindLabels,
  practiceDisplayName,
  type ClientDisplayData,
} from "@/lib/labels";

export type CaseTimelineParty = {
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

export type CaseTimelineActivityAttachment = {
  id: string;
  display_name: string;
};

export type CaseTimelineActivityHearing = {
  id: string;
  hearing_date: string;
  position: number;
};

export type CaseTimelineActivity = {
  id: string;
  activity_date: string;
  kind: "fee" | "expense_reimbursement";
  status: "to_invoice" | "invoiced";
  needs_review?: boolean | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  notes: string | null;
  activity_attachments?: CaseTimelineActivityAttachment[];
  case_activity_hearings?: CaseTimelineActivityHearing[];
};

export type CaseTimelineInvoice = {
  id: string;
  number: string;
  year: number;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  status: "draft" | "issued" | "paid" | "overdue";
  total_amount: number;
  notes: string | null;
};

export type CaseTimelineHistoryItem = {
  id: string;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  note: string | null;
};

export type CaseTimelineTransfer = {
  id: string;
  transferred_at: string;
  previous_client: CaseTimelineParty | null;
  new_client: CaseTimelineParty | null;
};

export type CaseTimelineCase = {
  id: string;
  opened_at: string;
  practice_number: number;
  title: string;
  status: string;
};

export type CaseTimelineItem = {
  id: string;
  date: string;
  title: string;
  description: string;
  meta: string;
  amount?: number | null;
  activityId?: string | null;
};

export function buildCaseTimelineItems({
  caseRow,
  activities,
  invoices,
  history,
  transfers,
}: {
  caseRow: CaseTimelineCase;
  activities: CaseTimelineActivity[];
  invoices: CaseTimelineInvoice[];
  history: CaseTimelineHistoryItem[];
  transfers: CaseTimelineTransfer[];
}) {
  const items: CaseTimelineItem[] = [
    {
      id: `case-opened-${caseRow.id}`,
      date: caseRow.opened_at,
      title: "Pratica aperta",
      description: practiceDisplayName(caseRow),
      meta: caseStatusLabels[caseRow.status] ?? caseRow.status,
    },
  ];

  activities.forEach((activity) => {
    const attachments = activity.activity_attachments ?? [];
    const hearings = sortedHearings(activity);
    items.push({
      id: `activity-${activity.id}`,
      date: activity.activity_date,
      title: activity.description,
      description: [
        priceItemKindLabels[activity.kind] ?? activity.kind,
        hearings.length
          ? `Udienze: ${hearings.map((hearing) => formatDate(hearing.hearing_date)).join(", ")}`
          : "",
        attachments.length ? `${attachments.length} allegati` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      meta: [
        caseActivityStatusLabels[activity.status] ?? activity.status,
        activity.needs_review ? "Da verificare" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      amount: Number(activity.amount) || 0,
      activityId: activity.id,
    });

    attachments.forEach((attachment) => {
      items.push({
        id: `attachment-${attachment.id}`,
        date: activity.activity_date,
        title: attachment.display_name,
        description: `Allegato collegato a ${activity.description}`,
        meta: "Allegato",
      });
    });
  });

  invoices.forEach((invoice) => {
    items.push({
      id: `invoice-${invoice.id}`,
      date: invoice.issue_date,
      title: `Fattura ${invoice.number}/${invoice.year}`,
      description: invoice.due_date ? `Scadenza ${formatDate(invoice.due_date)}` : "Fattura",
      meta: invoiceStatusLabels[invoice.status] ?? invoice.status,
      amount: Number(invoice.total_amount) || 0,
    });
  });

  history.forEach((item) => {
    items.push({
      id: `history-${item.id}`,
      date: item.changed_at,
      title: "Cambio stato",
      description: item.previous_status
        ? `${caseStatusLabels[item.previous_status] ?? item.previous_status} -> ${
            caseStatusLabels[item.new_status] ?? item.new_status
          }`
        : (caseStatusLabels[item.new_status] ?? item.new_status),
      meta: "Stato",
    });
  });

  transfers.forEach((transfer) => {
    items.push({
      id: `transfer-${transfer.id}`,
      date: transfer.transferred_at,
      title: "Cessione credito",
      description: `${transfer.previous_client ? clientDisplayName(transfer.previous_client as ClientDisplayData) : "-"} -> ${
        transfer.new_client ? clientDisplayName(transfer.new_client as ClientDisplayData) : "-"
      }`,
      meta: "Cliente",
    });
  });

  return items.toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function sortedHearings(activity: CaseTimelineActivity) {
  return [...(activity.case_activity_hearings ?? [])].toSorted((a, b) => a.position - b.position);
}
