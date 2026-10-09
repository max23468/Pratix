import {
  type PrincipalStatusFilter,
  type PrincipalEconomicsFilter,
  type CommittentiSortKey,
  type PrincipalListRow,
  type CommittentiFilters,
} from "@/components/principals/types";
import {
  type TableSort,
  type SortableColumn,
  parseTableSortKey,
  parseTableSortDirection,
  usePersistentTableSort,
  sortRows,
} from "@/lib/table-sorting";
import {
  economicRulesLabel,
  principalStatusFilters,
  principalEconomicsFilters,
  committentiSortKeys,
} from "@/components/principals/helpers";
import { createFileRoute, Link } from "@tanstack/react-router";
import { parseTextSearch, parseSearchValue, normalizeTextSearch } from "@/lib/search-params";
import { AppLayout } from "@/components/app-layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CommittentiToolbar } from "@/components/principals/committenti-toolbar";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { CommittentiMobileList } from "@/components/principals/committenti-mobile-list";
import { CommittentiTable } from "@/components/principals/committenti-table";

type CommittentiSearch = {
  q?: string;
  status?: PrincipalStatusFilter;
  economics?: PrincipalEconomicsFilter;
  sort?: CommittentiSortKey;
  dir?: "asc" | "desc";
};

const committentiDefaultSort: TableSort<CommittentiSortKey> = {
  key: "created_at",
  direction: "desc",
};

const committentiColumns: readonly SortableColumn<PrincipalListRow, CommittentiSortKey>[] = [
  {
    key: "business_name",
    label: "Ragione sociale",
    getValue: (principal) => principal.business_name,
  },
  {
    key: "status",
    label: "Stato",
    getValue: (principal) => (principal.archived_at ? "Archiviato" : "Attivo"),
  },
  {
    key: "economics",
    label: "Regole economiche",
    getValue: economicRulesLabel,
  },
  {
    key: "tax",
    label: "CF / P.IVA",
    getValue: (principal) => principal.vat_number || principal.tax_code,
  },
  { key: "email", label: "Email", getValue: (principal) => principal.email },
  { key: "city", label: "Citta", getValue: (principal) => principal.address_city },
  {
    key: "created_at",
    label: "Creazione",
    valueType: "date",
    defaultDirection: "desc",
    getValue: (principal) => principal.created_at,
  },
];

export const Route = createFileRoute("/committenti/")({
  validateSearch: (search: Record<string, unknown>): CommittentiSearch => ({
    q: parseTextSearch(search.q),
    status: parseSearchValue(search.status, principalStatusFilters),
    economics: parseSearchValue(search.economics, principalEconomicsFilters),
    sort: parseTableSortKey(search.sort, committentiSortKeys),
    dir: parseTableSortDirection(search.dir),
  }),
  head: () => ({
    meta: [
      { title: "Committenti · Pratix" },
      {
        name: "description",
        content: "Gestisci i committenti e le loro regole economiche.",
      },
      { property: "og:title", content: "Committenti · Pratix" },
      {
        property: "og:description",
        content: "Gestisci i committenti e le loro regole economiche.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <CommittentiList />
    </AppLayout>
  ),
});

function usePrincipalsQuery() {
  return useQuery({
    queryKey: ["principals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select(
          "id, public_code, business_name, tax_code, vat_number, email, address_city, fees_enabled, expense_reimbursements_enabled, archived_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrincipalListRow[];
    },
  });
}

function matchesStatus(principal: PrincipalListRow, status: PrincipalStatusFilter) {
  if (status === "active") return !principal.archived_at;
  if (status === "archived") return !!principal.archived_at;
  return true;
}

function matchesEconomics(principal: PrincipalListRow, economics: PrincipalEconomicsFilter) {
  const fees = principal.fees_enabled;
  const expenses = principal.expense_reimbursements_enabled;
  if (economics === "fees") return fees;
  if (economics === "expenses") return expenses;
  if (economics === "fees_only") return fees && !expenses;
  if (economics === "expenses_only") return !fees && expenses;
  return true;
}

function matchesSearchTerm(principal: PrincipalListRow, term: string) {
  if (!term) return true;
  return [
    principal.business_name,
    principal.tax_code,
    principal.vat_number,
    principal.email,
    principal.address_city,
  ]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(term));
}

function useFilteredPrincipals(
  data: PrincipalListRow[] | undefined,
  { q, status, economics }: CommittentiFilters,
) {
  return useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.filter(
      (principal) =>
        matchesStatus(principal, status) &&
        matchesEconomics(principal, economics) &&
        matchesSearchTerm(principal, term),
    );
  }, [data, economics, q, status]);
}

function urlSortFromSearch(search: CommittentiSearch) {
  return search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;
}

function hasActiveFilters({ q, status, economics }: CommittentiFilters) {
  return !!q || status !== "active" || economics !== "all";
}

function CommittentiList() {
  const navigate = Route.useNavigate();
  const routeSearch = Route.useSearch();
  const q = routeSearch.q ?? "";
  const status = routeSearch.status ?? "active";
  const economics = routeSearch.economics ?? "all";
  const urlSort = urlSortFromSearch(routeSearch);

  const updateSearch = (next: CommittentiSearch) =>
    navigate({
      search: {
        q: normalizeTextSearch(next.q ?? q),
        status: next.status && next.status !== "active" ? next.status : undefined,
        economics: next.economics && next.economics !== "all" ? next.economics : undefined,
        sort: next.sort ?? routeSearch.sort,
        dir: next.dir ?? routeSearch.dir,
      },
      replace: true,
    });

  const { data, isLoading } = usePrincipalsQuery();

  const { sort, setSort } = usePersistentTableSort({
    section: "committenti",
    columns: committentiColumns,
    defaultSort: committentiDefaultSort,
    urlSort,
    onSortChange: (next) =>
      updateSearch({ q, status, economics, sort: next.key, dir: next.direction }),
  });

  const filters = { q, status, economics };
  const filtered = useFilteredPrincipals(data, filters);
  const sorted = useMemo(() => sortRows(filtered, committentiColumns, sort), [filtered, sort]);
  const hasFilters = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Committenti"
        description="Società a cui fatturare compensi e rimborsi spese."
        actions={
          <Link to="/committenti/nuovo">
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Nuovo committente
            </Button>
          </Link>
        }
      />

      <CommittentiToolbar filters={filters} onChange={updateSearch} />

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={committentiColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        <CommittentiMobileList isLoading={isLoading} rows={sorted} hasFilters={hasFilters} />
      </div>

      <CommittentiTable
        sort={sort}
        onSort={setSort}
        isLoading={isLoading}
        rows={sorted}
        hasFilters={hasFilters}
        onOpen={(principalId) =>
          navigate({ to: "/committenti/$principalId", params: { principalId } })
        }
      />
    </>
  );
}
