import {
  committentiSortKeys,
  principalStatusFilters,
  principalEconomicsFilters,
} from "@/components/principals/helpers";

export type PrincipalListRow = {
  id: string;
  public_code: string;
  business_name: string;
  tax_code: string | null;
  vat_number: string | null;
  email: string | null;
  address_city: string | null;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
  archived_at: string | null;
  created_at: string;
};

export type CommittentiSortKey = (typeof committentiSortKeys)[number];

export type PrincipalStatusFilter = (typeof principalStatusFilters)[number];

export type PrincipalEconomicsFilter = (typeof principalEconomicsFilters)[number];

export type CommittentiFilters = {
  q: string;
  status: PrincipalStatusFilter;
  economics: PrincipalEconomicsFilter;
};

export type CommittentiListBodyProps = {
  isLoading: boolean;
  rows: PrincipalListRow[];
  hasFilters: boolean;
};
