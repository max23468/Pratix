import {
  type CounterpartyKindFilter,
  type ContropartiSortKey,
  type CounterpartyListRow,
  type ContropartiFilters,
} from "@/components/counterparties/types";
import {
  type TableSort,
  parseTableSortKey,
  parseTableSortDirection,
  type SortableColumn,
  usePersistentTableSort,
  sortRows,
} from "@/lib/table-sorting";
import { createFileRoute, Link } from "@tanstack/react-router";
import { parseTextSearch, parseSearchValue, normalizeTextSearch } from "@/lib/search-params";
import { counterpartyKindFilters, contropartiSortKeys } from "@/components/counterparties/helpers";
import { AppLayout } from "@/components/app-layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import {
  compareCounterparties,
  counterpartyDisplayName,
  counterpartyKindLabels,
} from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ContropartiToolbar } from "@/components/counterparties/controparti-toolbar";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { ContropartiMobileList } from "@/components/counterparties/controparti-mobile-list";
import { ContropartiTable } from "@/components/counterparties/controparti-table";

type ContropartiSearch = {
  q?: string;
  kind?: CounterpartyKindFilter;
  sort?: ContropartiSortKey;
  dir?: "asc" | "desc";
};

const contropartiDefaultSort: TableSort<ContropartiSortKey> = { key: "name", direction: "asc" };

export const Route = createFileRoute("/controparti/")({
  validateSearch: (search: Record<string, unknown>): ContropartiSearch => ({
    q: parseTextSearch(search.q),
    kind: parseSearchValue(search.kind, counterpartyKindFilters),
    sort: parseTableSortKey(search.sort, contropartiSortKeys),
    dir: parseTableSortDirection(search.dir),
  }),
  head: () => ({
    meta: [
      { title: "Controparti · Pratix" },
      {
        name: "description",
        content: "Gestisci società, persone e controparti composte.",
      },
      { property: "og:title", content: "Controparti · Pratix" },
      {
        property: "og:description",
        content: "Gestisci società, persone e controparti composte.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <ContropartiList />
    </AppLayout>
  ),
});

function useCounterpartiesQuery() {
  return useQuery({
    queryKey: ["counterparties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, public_code, kind, first_name, last_name, business_name, notes, updated_at");
      if (error) throw error;
      return (data ?? []) as CounterpartyListRow[];
    },
  });
}

function useSubjectCounts() {
  const { data: subjects = [] } = useQuery({
    queryKey: ["counterparty-subjects", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparty_subjects")
        .select("counterparty_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(() => {
    return subjects.reduce<Record<string, number>>((acc, subject) => {
      acc[subject.counterparty_id] = (acc[subject.counterparty_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [subjects]);
}

function useContropartiColumns(subjectCounts: Record<string, number>) {
  return useMemo<readonly SortableColumn<CounterpartyListRow, ContropartiSortKey>[]>(
    () => [
      {
        key: "name",
        label: "Nome",
        compare: compareCounterparties,
        getValue: counterpartyDisplayName,
      },
      {
        key: "kind",
        label: "Tipo",
        getValue: (counterparty) => counterpartyKindLabels[counterparty.kind] ?? counterparty.kind,
      },
      {
        key: "subjects",
        label: "Soggetti",
        valueType: "number",
        getValue: (counterparty) =>
          counterparty.kind === "group" ? (subjectCounts[counterparty.id] ?? 0) : null,
      },
      { key: "notes", label: "Note", getValue: (counterparty) => counterparty.notes },
      {
        key: "updated_at",
        label: "Aggiornamento",
        valueType: "date",
        defaultDirection: "desc",
        getValue: (counterparty) => counterparty.updated_at,
      },
    ],
    [subjectCounts],
  );
}

function matchesCounterpartyFilters(
  counterparty: CounterpartyListRow,
  kind: CounterpartyKindFilter,
  term: string,
) {
  if (kind !== "all" && counterparty.kind !== kind) return false;
  if (!term) return true;
  const name = counterpartyDisplayName(counterparty).toLowerCase();
  return name.includes(term) || (counterparty.notes ?? "").toLowerCase().includes(term);
}

function useFilteredCounterparties(
  counterparties: CounterpartyListRow[] | undefined,
  { q, kind }: ContropartiFilters,
) {
  return useMemo(() => {
    if (!counterparties) return [];
    const term = q.trim().toLowerCase();
    return counterparties.filter((counterparty) =>
      matchesCounterpartyFilters(counterparty, kind, term),
    );
  }, [counterparties, kind, q]);
}

function urlSortFromSearch(search: ContropartiSearch) {
  return search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;
}

function ContropartiList() {
  const navigate = Route.useNavigate();
  const routeSearch = Route.useSearch();
  const q = routeSearch.q ?? "";
  const kind = routeSearch.kind ?? "all";
  const urlSort = urlSortFromSearch(routeSearch);

  const updateSearch = (next: ContropartiSearch) =>
    navigate({
      search: {
        q: normalizeTextSearch(next.q ?? q),
        kind: next.kind && next.kind !== "all" ? next.kind : undefined,
        sort: next.sort ?? routeSearch.sort,
        dir: next.dir ?? routeSearch.dir,
      },
      replace: true,
    });

  const { data: counterparties, isLoading } = useCounterpartiesQuery();
  const subjectCounts = useSubjectCounts();
  const contropartiColumns = useContropartiColumns(subjectCounts);

  const { sort, setSort } = usePersistentTableSort({
    section: "controparti",
    columns: contropartiColumns,
    defaultSort: contropartiDefaultSort,
    urlSort,
    onSortChange: (next) => updateSearch({ q, kind, sort: next.key, dir: next.direction }),
  });

  const filters = { q, kind };
  const filtered = useFilteredCounterparties(counterparties, filters);
  const sorted = useMemo(
    () => sortRows(filtered, contropartiColumns, sort, compareCounterparties),
    [contropartiColumns, filtered, sort],
  );
  const hasFilters = !!q || kind !== "all";

  return (
    <>
      <PageHeader
        title="Controparti"
        description="Anagrafica di debitori, società e gruppi di soggetti."
        actions={
          <Link to="/controparti/nuova">
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Nuova controparte
            </Button>
          </Link>
        }
      />

      <ContropartiToolbar filters={filters} onChange={updateSearch} />

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={contropartiColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        <ContropartiMobileList
          isLoading={isLoading}
          rows={sorted}
          hasFilters={hasFilters}
          subjectCounts={subjectCounts}
        />
      </div>

      <ContropartiTable
        sort={sort}
        onSort={setSort}
        isLoading={isLoading}
        rows={sorted}
        hasFilters={hasFilters}
        subjectCounts={subjectCounts}
        onOpen={(counterpartyId) =>
          navigate({ to: "/controparti/$counterpartyId", params: { counterpartyId } })
        }
      />
    </>
  );
}
