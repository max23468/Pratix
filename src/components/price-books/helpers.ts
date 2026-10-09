import { type PriceBookCounts } from "@/components/price-books/types";

export const prezziSortKeys = [
  "principal",
  "year",
  "status",
  "rules",
  "items",
  "validity",
  "updated_at",
] as const;

export const emptyPriceBookCounts: PriceBookCounts = { fees: 0, expenses: 0, enabled: 0 };

export function rulesLabel(book: {
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
}) {
  if (book.fees_enabled && book.expense_reimbursements_enabled) return "Compensi e rimborsi";
  if (book.fees_enabled) return "Solo compensi";
  if (book.expense_reimbursements_enabled) return "Solo rimborsi";
  return "Nessuna regola";
}
