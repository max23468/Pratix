import { type PracticeActivitySummary } from "@/components/practices/types";
import { formatCurrency } from "@/lib/format";

export const praticheSortKeys = [
  "practice_number",
  "principal",
  "client",
  "counterparty",
  "status",
  "billing",
  "opened_at",
  "updated_at",
] as const;

export const praticheViewKeys = [
  "all",
  "open",
  "without_activities",
  "to_complete",
  "to_invoice",
  "invoiced",
  "suspended",
  "closed",
  "archived",
] as const;

export const emptyPracticeActivitySummary: PracticeActivitySummary = {
  toInvoice: 0,
  invoiced: 0,
  toInvoiceAmount: 0,
};

export function practiceBillingLabel(summary: PracticeActivitySummary, withAmount: boolean) {
  if (summary.toInvoice > 0) {
    const base = `${summary.toInvoice} da fatturare`;
    return withAmount ? `${base} · ${formatCurrency(summary.toInvoiceAmount)}` : base;
  }
  return summary.invoiced > 0 ? `${summary.invoiced} fatturate` : "—";
}
