import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { ListToolbar } from "@/components/list-toolbar";
import { MobileListCardHeader, mobileListCardLinkClassName } from "@/components/mobile-list-card";
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

function ContropartiList() {
  const navigate = Route.useNavigate();
  const routeSearch = Route.useSearch();
  const q = routeSearch.q ?? "";
  const kind = routeSearch.kind ?? "all";
  const urlSort =
    routeSearch.sort && routeSearch.dir
      ? { key: routeSearch.sort, direction: routeSearch.dir }
      : undefined;

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

  const { data: counterparties, isLoading } = useQuery({
    queryKey: ["counterparties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, public_code, kind, first_name, last_name, business_name, notes, updated_at");
      if (error) throw error;
      return (data ?? []) as CounterpartyListRow[];
    },
  });

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

  const subjectCounts = useMemo(() => {
    return subjects.reduce<Record<string, number>>((acc, subject) => {
      acc[subject.counterparty_id] = (acc[subject.counterparty_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [subjects]);

  const contropartiColumns = useMemo<
    readonly SortableColumn<CounterpartyListRow, ContropartiSortKey>[]
  >(
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

  const { sort, setSort } = usePersistentTableSort({
    section: "controparti",
    columns: contropartiColumns,
    defaultSort: contropartiDefaultSort,
    urlSort,
    onSortChange: (next) => updateSearch({ q, kind, sort: next.key, dir: next.direction }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!counterparties) return [];
    return counterparties.filter((counterparty) => {
      if (kind !== "all" && counterparty.kind !== kind) return false;
      if (!term) return true;
      const name = counterpartyDisplayName(counterparty).toLowerCase();
      return name.includes(term) || (counterparty.notes ?? "").toLowerCase().includes(term);
    });
  }, [counterparties, kind, q]);

  const sorted = useMemo(
    () => sortRows(filtered, contropartiColumns, sort, compareCounterparties),
    [contropartiColumns, filtered, sort],
  );

  const openCounterparty = (counterpartyId: string) =>
    navigate({ to: "/controparti/$counterpartyId", params: { counterpartyId } });

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

      <ListToolbar className="sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Cerca per nome, ragione sociale o note…"
          value={q}
          onChange={(value) => updateSearch({ q: value, kind })}
        />
        <Select
          value={kind}
          onValueChange={(value) => updateSearch({ q, kind: value as CounterpartyKindFilter })}
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

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={contropartiColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>
        ) : sorted.length === 0 ? (
          <Card className="p-4">
            <TableEmptyState
              title={q || kind !== "all" ? "Nessuna controparte trovata" : "Nessuna controparte"}
              description={
                q || kind !== "all"
                  ? "Modifica ricerca o filtro per ampliare i risultati."
                  : "Aggiungi la prima controparte per collegarla alle pratiche."
              }
              action={
                !q && kind === "all" ? (
                  <Button size="sm" asChild>
                    <Link to="/controparti/nuova">Nuova controparte</Link>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          sorted.map((counterparty) => {
            const displayName = counterpartyDisplayName(counterparty);
            return (
              <Link
                key={counterparty.id}
                to="/controparti/$counterpartyId"
                params={{ counterpartyId: routeRef(counterparty) }}
                className={mobileListCardLinkClassName}
              >
                <MobileListCardHeader
                  title={displayName}
                  subtitle={
                    counterparty.kind === "group"
                      ? `${subjectCounts[counterparty.id] ?? 0} soggetti`
                      : "Controparte singola"
                  }
                  badge={
                    <Badge variant="outline">
                      {counterpartyKindLabels[counterparty.kind] ?? counterparty.kind}
                    </Badge>
                  }
                />
                {counterparty.notes && (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {counterparty.notes}
                  </p>
                )}
              </Link>
            );
          })
        )}
      </div>

      <Card className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead columnKey="name" label="Nome" sort={sort} onSort={setSort} />
              <SortableTableHead columnKey="kind" label="Tipo" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="subjects"
                label="Soggetti"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="notes" label="Note" sort={sort} onSort={setSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  <TableEmptyState
                    title={
                      q || kind !== "all" ? "Nessuna controparte trovata" : "Nessuna controparte"
                    }
                    description={
                      q || kind !== "all"
                        ? "Modifica ricerca o filtro per ampliare i risultati."
                        : "Aggiungi la prima controparte per collegarla alle pratiche."
                    }
                    action={
                      !q && kind === "all" ? (
                        <Button size="sm" asChild>
                          <Link to="/controparti/nuova">Nuova controparte</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((counterparty) => {
                const displayName = counterpartyDisplayName(counterparty);
                return (
                  <TableRow
                    key={counterparty.id}
                    className="cursor-pointer"
                    role="link"
                    tabIndex={0}
                    aria-label={`Apri controparte ${displayName}`}
                    onClick={(event) =>
                      handleClickableTableRowClick(event, () =>
                        openCounterparty(routeRef(counterparty)),
                      )
                    }
                    onKeyDown={(event) =>
                      handleClickableTableRowKeyDown(event, () =>
                        openCounterparty(routeRef(counterparty)),
                      )
                    }
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
                      {counterparty.kind === "group" ? (subjectCounts[counterparty.id] ?? 0) : "—"}
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-sm text-muted-foreground">
                      {counterparty.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
