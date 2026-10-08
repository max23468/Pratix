import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { ListToolbar } from "@/components/list-toolbar";
import { mobileListCardLinkClassName } from "@/components/mobile-list-card";
import { MobileListCardDetails } from "@/components/mobile-list-card-details";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableEmptyState } from "@/components/table-empty-state";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { priceBookStatusLabels, priceBookStatusVariant } from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import { normalizeTextSearch, parseTextSearch } from "@/lib/search-params";
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

type PrezziSearch = {
  q?: string;
  sort?: PrezziSortKey;
  dir?: "asc" | "desc";
};

type PriceBookListRow = {
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

const prezziSortKeys = [
  "principal",
  "year",
  "status",
  "rules",
  "items",
  "validity",
  "updated_at",
] as const;

type PrezziSortKey = (typeof prezziSortKeys)[number];

const prezziDefaultSort: TableSort<PrezziSortKey> = { key: "year", direction: "desc" };

export const Route = createFileRoute("/prezzi/")({
  validateSearch: (search: Record<string, unknown>): PrezziSearch => ({
    q: parseTextSearch(search.q),
    sort: parseTableSortKey(search.sort, prezziSortKeys),
    dir: parseTableSortDirection(search.dir),
  }),
  head: () => ({
    meta: [
      { title: "Prezzi · Pratix" },
      {
        name: "description",
        content: "Gestisci i prezzi annuali dei committenti.",
      },
      { property: "og:title", content: "Prezzi · Pratix" },
      {
        property: "og:description",
        content: "Gestisci i prezzi annuali dei committenti.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <PrezziList />
    </AppLayout>
  ),
});

type PriceBookCounts = { fees: number; expenses: number; enabled: number };

const emptyPriceBookCounts: PriceBookCounts = { fees: 0, expenses: 0, enabled: 0 };

function usePriceBooksQuery() {
  return useQuery({
    queryKey: ["price-books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_books")
        .select(
          "id, public_code, principal_id, year, status, fees_enabled, expense_reimbursements_enabled, valid_from, valid_to, updated_at",
        )
        .order("year", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriceBookListRow[];
    },
  });
}

function usePrincipalNameById() {
  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "price-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(
    () => new Map(principals.map((principal) => [principal.id, principal.business_name])),
    [principals],
  );
}

function usePriceItemCounts() {
  const { data: priceItems = [] } = useQuery({
    queryKey: ["price-items", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_items")
        .select("price_book_id, kind, is_enabled");
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(() => {
    return priceItems.reduce<Record<string, PriceBookCounts>>((acc, item) => {
      const current = acc[item.price_book_id] ?? { fees: 0, expenses: 0, enabled: 0 };
      if (item.kind === "fee") current.fees += 1;
      if (item.kind === "expense_reimbursement") current.expenses += 1;
      if (item.is_enabled) current.enabled += 1;
      acc[item.price_book_id] = current;
      return acc;
    }, {});
  }, [priceItems]);
}

function usePrezziColumns(
  principalNameById: Map<string, string>,
  countsByBook: Record<string, PriceBookCounts>,
) {
  return useMemo<readonly SortableColumn<PriceBookListRow, PrezziSortKey>[]>(
    () => [
      {
        key: "principal",
        label: "Committente",
        getValue: (book) => principalNameById.get(book.principal_id),
      },
      {
        key: "year",
        label: "Anno",
        valueType: "number",
        defaultDirection: "desc",
        getValue: (book) => book.year,
      },
      {
        key: "status",
        label: "Stato",
        getValue: (book) => priceBookStatusLabels[book.status] ?? book.status,
      },
      { key: "rules", label: "Regole", getValue: rulesLabel },
      {
        key: "items",
        label: "Voci",
        valueType: "number",
        defaultDirection: "desc",
        getValue: (book) => countsByBook[book.id]?.enabled ?? 0,
      },
      {
        key: "validity",
        label: "Validità",
        valueType: "date",
        defaultDirection: "desc",
        getValue: (book) => book.valid_from,
      },
      {
        key: "updated_at",
        label: "Aggiornamento",
        valueType: "date",
        defaultDirection: "desc",
        getValue: (book) => book.updated_at,
      },
    ],
    [countsByBook, principalNameById],
  );
}

function useFilteredPriceBooks(
  priceBooks: PriceBookListRow[],
  principalNameById: Map<string, string>,
  q: string,
) {
  return useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return priceBooks;
    return priceBooks.filter((book) => {
      const principalName = principalNameById.get(book.principal_id)?.toLowerCase() ?? "";
      return (
        principalName.includes(term) ||
        String(book.year).includes(term) ||
        priceBookStatusLabels[book.status].toLowerCase().includes(term)
      );
    });
  }, [priceBooks, principalNameById, q]);
}

function comparePriceBooks(a: PriceBookListRow, b: PriceBookListRow) {
  return b.year - a.year || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function urlSortFromSearch(search: PrezziSearch) {
  return search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;
}

function PriceBookMobileCard({
  book,
  counts,
  principalName,
}: {
  book: PriceBookListRow;
  counts: PriceBookCounts;
  principalName: string;
}) {
  return (
    <Link
      to="/prezzi/$priceBookId"
      params={{ priceBookId: routeRef(book) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={principalName}
        subtitle={`Anno ${book.year}`}
        badge={
          <Badge variant={priceBookStatusVariant[book.status]}>
            {priceBookStatusLabels[book.status]}
          </Badge>
        }
      />
      <MobileListCardDetails
        rows={[
          { label: "Regole", value: rulesLabel(book) },
          {
            label: "Voci",
            value: `${counts.fees} compensi, ${counts.expenses} rimborsi`,
          },
          {
            label: "Validità",
            value: `${book.valid_from} → ${book.valid_to ?? "senza fine"}`,
          },
        ]}
      />
    </Link>
  );
}

function PrezziEmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <TableEmptyState
      title={hasSearch ? "Nessun prezzo trovato" : "Nessun prezzo"}
      description={
        hasSearch
          ? "Modifica ricerca o ordinamento per ampliare i risultati."
          : "Crea il primo set annuale per un committente."
      }
      action={
        hasSearch ? undefined : (
          <Button size="sm" asChild>
            <Link to="/prezzi/nuovo">Nuovi prezzi</Link>
          </Button>
        )
      }
    />
  );
}

type PrezziListBodyProps = {
  isLoading: boolean;
  rows: PriceBookListRow[];
  hasSearch: boolean;
  principalNameById: Map<string, string>;
  countsByBook: Record<string, PriceBookCounts>;
};

function PrezziMobileList({
  isLoading,
  rows,
  hasSearch,
  principalNameById,
  countsByBook,
}: PrezziListBodyProps) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <PrezziEmptyState hasSearch={hasSearch} />
      </Card>
    );
  }
  return rows.map((book) => (
    <PriceBookMobileCard
      key={book.id}
      book={book}
      counts={countsByBook[book.id] ?? emptyPriceBookCounts}
      principalName={principalNameById.get(book.principal_id) ?? "—"}
    />
  ));
}

function PrezziTableMessage({ children }: { children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

function PrezziTableBody({
  isLoading,
  rows,
  hasSearch,
  principalNameById,
  countsByBook,
  onOpen,
}: PrezziListBodyProps & { onOpen: (priceBookId: string) => void }) {
  if (isLoading) return <PrezziTableMessage>Caricamento…</PrezziTableMessage>;
  if (rows.length === 0) {
    return (
      <PrezziTableMessage>
        {hasSearch ? "Nessun risultato." : "Nessun prezzo. Crea il primo set annuale."}
      </PrezziTableMessage>
    );
  }
  return rows.map((book) => (
    <PriceBookTableRow
      key={book.id}
      book={book}
      counts={countsByBook[book.id] ?? emptyPriceBookCounts}
      principalName={principalNameById.get(book.principal_id) ?? "—"}
      onOpen={() => onOpen(routeRef(book))}
    />
  ));
}

function PrezziTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<PrezziSortKey>;
  onSort: (key: PrezziSortKey) => void;
} & React.ComponentProps<typeof PrezziTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              columnKey="principal"
              label="Committente"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead columnKey="year" label="Anno" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="rules" label="Regole" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="items" label="Voci" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="validity" label="Validità" sort={sort} onSort={onSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          <PrezziTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
}

function PrezziList() {
  const navigate = Route.useNavigate();
  const routeSearch = Route.useSearch();
  const q = routeSearch.q ?? "";
  const urlSort = urlSortFromSearch(routeSearch);

  const updateSearch = (next: PrezziSearch) =>
    navigate({
      search: {
        q: normalizeTextSearch(next.q ?? q),
        sort: next.sort ?? routeSearch.sort,
        dir: next.dir ?? routeSearch.dir,
      },
      replace: true,
    });

  const { data: priceBooks = [], isLoading } = usePriceBooksQuery();
  const principalNameById = usePrincipalNameById();
  const countsByBook = usePriceItemCounts();
  const prezziColumns = usePrezziColumns(principalNameById, countsByBook);

  const { sort, setSort } = usePersistentTableSort({
    section: "prezzi",
    columns: prezziColumns,
    defaultSort: prezziDefaultSort,
    urlSort,
    onSortChange: (next) => updateSearch({ q, sort: next.key, dir: next.direction }),
  });

  const filtered = useFilteredPriceBooks(priceBooks, principalNameById, q);
  const sorted = useMemo(
    () => sortRows(filtered, prezziColumns, sort, comparePriceBooks),
    [filtered, prezziColumns, sort],
  );
  const bodyProps = {
    isLoading,
    rows: sorted,
    hasSearch: !!q,
    principalNameById,
    countsByBook,
  };

  return (
    <>
      <PageHeader
        title="Prezzi"
        description="Voci annuali per committente: compensi e rimborsi spese."
        actions={
          <Link to="/prezzi/nuovo">
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Nuovi prezzi
            </Button>
          </Link>
        }
      />

      <ListToolbar>
        <SearchInput
          placeholder="Cerca per committente, anno o stato…"
          value={q}
          onChange={(value) => updateSearch({ q: value })}
        />
      </ListToolbar>

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={prezziColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        <PrezziMobileList {...bodyProps} />
      </div>

      <PrezziTable
        {...bodyProps}
        sort={sort}
        onSort={setSort}
        onOpen={(priceBookId) => navigate({ to: "/prezzi/$priceBookId", params: { priceBookId } })}
      />
    </>
  );
}

function PriceBookTableRow({
  book,
  counts,
  principalName,
  onOpen,
}: {
  book: PriceBookListRow;
  counts: { fees: number; expenses: number; enabled: number };
  principalName: string;
  onOpen: () => void;
}) {
  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`Apri prezzi ${principalName} ${book.year}`}
      onClick={(event) => handleClickableTableRowClick(event, onOpen)}
      onKeyDown={(event) => handleClickableTableRowKeyDown(event, onOpen)}
    >
      <TableCell>
        <Link
          to="/prezzi/$priceBookId"
          params={{ priceBookId: routeRef(book) }}
          className="font-medium hover:underline"
        >
          {principalName}
        </Link>
      </TableCell>
      <TableCell>{book.year}</TableCell>
      <TableCell>
        <Badge variant={priceBookStatusVariant[book.status]}>
          {priceBookStatusLabels[book.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{rulesLabel(book)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {counts.fees} compensi, {counts.expenses} rimborsi
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {book.valid_from} → {book.valid_to ?? "senza fine"}
      </TableCell>
    </TableRow>
  );
}

function rulesLabel(book: { fees_enabled: boolean; expense_reimbursements_enabled: boolean }) {
  if (book.fees_enabled && book.expense_reimbursements_enabled) return "Compensi e rimborsi";
  if (book.fees_enabled) return "Solo compensi";
  if (book.expense_reimbursements_enabled) return "Solo rimborsi";
  return "Nessuna regola";
}
