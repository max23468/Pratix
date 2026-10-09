import {
  type PrezziSortKey,
  type PriceBookListRow,
  type PriceBookCounts,
} from "@/components/price-books/types";
import {
  type TableSort,
  parseTableSortKey,
  parseTableSortDirection,
  type SortableColumn,
  usePersistentTableSort,
  sortRows,
} from "@/lib/table-sorting";
import { createFileRoute, Link } from "@tanstack/react-router";
import { parseTextSearch, normalizeTextSearch } from "@/lib/search-params";
import { prezziSortKeys, rulesLabel } from "@/components/price-books/helpers";
import { AppLayout } from "@/components/app-layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { priceBookStatusLabels } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ListToolbar } from "@/components/list-toolbar";
import { SearchInput } from "@/components/search-input";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { PrezziMobileList } from "@/components/price-books/prezzi-mobile-list";
import { PrezziTable } from "@/components/price-books/prezzi-table";

type PrezziSearch = {
  q?: string;
  sort?: PrezziSortKey;
  dir?: "asc" | "desc";
};

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
