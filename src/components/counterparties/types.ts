import { contropartiSortKeys, counterpartyKindFilters } from "@/components/counterparties/helpers";

export type CounterpartyListRow = {
  id: string;
  public_code: string;
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
  updated_at: string;
};

export type ContropartiSortKey = (typeof contropartiSortKeys)[number];

export type CounterpartyKindFilter = (typeof counterpartyKindFilters)[number];

export type ContropartiFilters = { q: string; kind: CounterpartyKindFilter };

export type ContropartiListBodyProps = {
  isLoading: boolean;
  rows: CounterpartyListRow[];
  hasFilters: boolean;
  subjectCounts: Record<string, number>;
};
