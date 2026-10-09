import { clientiSortKeys, clientKindFilters } from "@/components/clients/helpers";

export type ClientListRow = {
  id: string;
  public_code: string;
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  created_at: string;
};

export type ClientiSortKey = (typeof clientiSortKeys)[number];

export type ClientKindFilter = (typeof clientKindFilters)[number];

export type PrincipalOption = { id: string; business_name: string; archived_at: string | null };

export type ClientiFilters = { q: string; kind: ClientKindFilter; principalId: string };
