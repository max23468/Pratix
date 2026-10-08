import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { ListToolbar } from "@/components/list-toolbar";
import { mobileListCardLinkClassName } from "@/components/mobile-list-card";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { PageHeader } from "@/components/page-header";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { TableEmptyState } from "@/components/table-empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  compareCounterparties,
  counterpartyDisplayName,
  counterpartyKindLabels,
} from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import { normalizeTextSearch, parseSearchValue, parseTextSearch } from "@/lib/search-params";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import {
  parseTableSortDirection,
  parseTableSortKey,
  sortRows,
  usePersistentTableSort,
  type SortableColumn,
  type TableSort,
} from "@/lib/table-sorting";

type ContropartiSearch = {
  q?: string;
  kind?: CounterpartyKindFilter;
  sort?: ContropartiSortKey;
  dir?: "asc" | "desc";
};

type CounterpartyListRow = {
  id: string;
  public_code: string;
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
  updated_at: string;
};

const contropartiSortKeys = ["name", "kind", "subjects", "notes", "updated_at"] as const;

type ContropartiSortKey = (typeof contropartiSortKeys)[number];

const counterpartyKindFilters = ["all", ...Object.keys(counterpartyKindLabels)] as const;
type CounterpartyKindFilter = (typeof counterpartyKindFilters)[number];

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

type ContropartiFilters = { q: string; kind: CounterpartyKindFilter };

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

function ContropartiToolbar({
  filters,
  onChange,
}: {
  filters: ContropartiFilters;
  onChange: (next: ContropartiFilters) => void;
}) {
  const { q, kind } = filters;
  return (
    <ListToolbar className="sm:flex-row sm:items-center">
      <SearchInput
        placeholder="Cerca per nome, ragione sociale o note…"
        value={q}
        onChange={(value) => onChange({ q: value, kind })}
      />
      <Select
        value={kind}
        onValueChange={(value) => onChange({ q, kind: value as CounterpartyKindFilter })}
      >
        <SelectTrigger aria-label="Filtra controparti per tipo" className="sm:w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i tipi</SelectItem>
          {Object.entries(counterpartyKindLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ListToolbar>
  );
}

function ContropartiEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <TableEmptyState
      title={hasFilters ? "Nessuna controparte trovata" : "Nessuna controparte"}
      description={
        hasFilters
          ? "Modifica ricerca o filtro per ampliare i risultati."
          : "Aggiungi la prima controparte per collegarla alle pratiche."
      }
      action={
        hasFilters ? undefined : (
          <Button size="sm" asChild>
            <Link to="/controparti/nuova">Nuova controparte</Link>
          </Button>
        )
      }
    />
  );
}

function CounterpartyMobileCard({
  counterparty,
  subjectCount,
}: {
  counterparty: CounterpartyListRow;
  subjectCount: number;
}) {
  return (
    <Link
      to="/controparti/$counterpartyId"
      params={{ counterpartyId: routeRef(counterparty) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={counterpartyDisplayName(counterparty)}
        subtitle={
          counterparty.kind === "group" ? `${subjectCount} soggetti` : "Controparte singola"
        }
        badge={
          <Badge variant="outline">
            {counterpartyKindLabels[counterparty.kind] ?? counterparty.kind}
          </Badge>
        }
      />
      {counterparty.notes && (
        <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{counterparty.notes}</p>
      )}
    </Link>
  );
}

type ContropartiListBodyProps = {
  isLoading: boolean;
  rows: CounterpartyListRow[];
  hasFilters: boolean;
  subjectCounts: Record<string, number>;
};

function ContropartiMobileList({
  isLoading,
  rows,
  hasFilters,
  subjectCounts,
}: ContropartiListBodyProps) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <ContropartiEmptyState hasFilters={hasFilters} />
      </Card>
    );
  }
  return rows.map((counterparty) => (
    <CounterpartyMobileCard
      key={counterparty.id}
      counterparty={counterparty}
      subjectCount={subjectCounts[counterparty.id] ?? 0}
    />
  ));
}

function ContropartiTableBody({
  isLoading,
  rows,
  hasFilters,
  subjectCounts,
  onOpen,
}: ContropartiListBodyProps & { onOpen: (counterpartyId: string) => void }) {
  if (isLoading || rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
          {isLoading ? "Caricamento…" : <ContropartiEmptyState hasFilters={hasFilters} />}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((counterparty) => (
    <CounterpartyTableRow
      key={counterparty.id}
      counterparty={counterparty}
      subjectCount={subjectCounts[counterparty.id] ?? 0}
      onOpen={() => onOpen(routeRef(counterparty))}
    />
  ));
}

function ContropartiTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<ContropartiSortKey>;
  onSort: (key: ContropartiSortKey) => void;
} & React.ComponentProps<typeof ContropartiTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead columnKey="name" label="Nome" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="kind" label="Tipo" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="subjects" label="Soggetti" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="notes" label="Note" sort={sort} onSort={onSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          <ContropartiTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
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

function CounterpartyTableRow({
  counterparty,
  subjectCount,
  onOpen,
}: {
  counterparty: CounterpartyListRow;
  subjectCount: number;
  onOpen: () => void;
}) {
  const displayName = counterpartyDisplayName(counterparty);
  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`Apri controparte ${displayName}`}
      onClick={(event) => handleClickableTableRowClick(event, onOpen)}
      onKeyDown={(event) => handleClickableTableRowKeyDown(event, onOpen)}
    >
      <TableCell>
        <Link
          to="/controparti/$counterpartyId"
          params={{ counterpartyId: routeRef(counterparty) }}
          className="font-medium hover:underline"
        >
          {displayName}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {counterpartyKindLabels[counterparty.kind] ?? counterparty.kind}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {counterparty.kind === "group" ? subjectCount : "—"}
      </TableCell>
      <TableCell className="max-w-sm truncate text-sm text-muted-foreground">
        {counterparty.notes ?? "—"}
      </TableCell>
    </TableRow>
  );
}
