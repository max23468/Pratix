import { prezziSortKeys } from "@/components/price-books/helpers";

export type PriceBookListRow = {
  id: string;
  public_code: string;
  principal_id: string;
  year: number;
  status: string;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
  valid_from: string;
  valid_to: string | null;
  updated_at: string;
};

export type PrezziSortKey = (typeof prezziSortKeys)[number];

export type PriceBookCounts = { fees: number; expenses: number; enabled: number };

export type PrezziListBodyProps = {
  isLoading: boolean;
  rows: PriceBookListRow[];
  hasSearch: boolean;
  principalNameById: Map<string, string>;
  countsByBook: Record<string, PriceBookCounts>;
};
