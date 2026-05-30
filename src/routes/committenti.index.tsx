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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
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

type CommittentiSearch = {
  q?: string;
  status?: PrincipalStatusFilter;
  economics?: PrincipalEconomicsFilter;
  sort?: CommittentiSortKey;
  dir?: "asc" | "desc";
};

type PrincipalListRow = {
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

const committentiSortKeys = [
  "business_name",
  "status",
  "economics",
  "tax",
  "email",
  "city",
  "created_at",
] as const;

type CommittentiSortKey = (typeof committentiSortKeys)[number];

const committentiDefaultSort: TableSort<CommittentiSortKey> = {
  key: "created_at",
  direction: "desc",
};

const principalStatusFilters = ["all", "active", "archived"] as const;
type PrincipalStatusFilter = (typeof principalStatusFilters)[number];

const principalEconomicsFilters = [
  "all",
  "fees",
  "expenses",
  "fees_only",
  "expenses_only",
] as const;
type PrincipalEconomicsFilter = (typeof principalEconomicsFilters)[number];

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

function CommittentiList() {
  const navigate = Route.useNavigate();
  const routeSearch = Route.useSearch();
  const q = routeSearch.q ?? "";
  const status = routeSearch.status ?? "active";
  const economics = routeSearch.economics ?? "all";
  const urlSort =
    routeSearch.sort && routeSearch.dir
      ? { key: routeSearch.sort, direction: routeSearch.dir }
      : undefined;

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

  const { data, isLoading } = useQuery({
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

  const { sort, setSort } = usePersistentTableSort({
    section: "committenti",
    columns: committentiColumns,
    defaultSort: committentiDefaultSort,
    urlSort,
    onSortChange: (next) =>
      updateSearch({ q, status, economics, sort: next.key, dir: next.direction }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!data) return [];
    return data.filter((principal) => {
      if (status === "active" && principal.archived_at) return false;
      if (status === "archived" && !principal.archived_at) return false;
      if (economics === "fees" && !principal.fees_enabled) return false;
      if (economics === "expenses" && !principal.expense_reimbursements_enabled) return false;
      if (
        economics === "fees_only" &&
        (!principal.fees_enabled || principal.expense_reimbursements_enabled)
      ) {
        return false;
      }
      if (
        economics === "expenses_only" &&
        (principal.fees_enabled || !principal.expense_reimbursements_enabled)
      ) {
        return false;
      }
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
    });
  }, [data, economics, q, status]);

  const sorted = useMemo(() => sortRows(filtered, committentiColumns, sort), [filtered, sort]);

  const openPrincipal = (principalId: string) =>
    navigate({ to: "/committenti/$principalId", params: { principalId } });

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

      <ListToolbar>
        <SearchInput
          placeholder="Cerca per ragione sociale, CF, P.IVA, email…"
          value={q}
          onChange={(value) => updateSearch({ q: value, status, economics })}
        />
        <Select
          value={status}
          onValueChange={(value) =>
            updateSearch({ q, status: value as PrincipalStatusFilter, economics })
          }
        >
          <SelectTrigger aria-label="Filtra committenti per stato" className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivi</SelectItem>
            <SelectItem value="archived">Archiviati</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={economics}
          onValueChange={(value) =>
            updateSearch({ q, status, economics: value as PrincipalEconomicsFilter })
          }
        >
          <SelectTrigger aria-label="Filtra committenti per regole economiche" className="lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le regole</SelectItem>
            <SelectItem value="fees">Con compensi</SelectItem>
            <SelectItem value="expenses">Con rimborsi</SelectItem>
            <SelectItem value="fees_only">Solo compensi</SelectItem>
            <SelectItem value="expenses_only">Solo rimborsi</SelectItem>
          </SelectContent>
        </Select>
      </ListToolbar>

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={committentiColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>
        ) : sorted.length === 0 ? (
          <Card className="p-4">
            <TableEmptyState
              title={
                q || status !== "active" || economics !== "all"
                  ? "Nessun committente trovato"
                  : "Nessun committente"
              }
              description={
                q || status !== "active" || economics !== "all"
                  ? "Modifica ricerca o filtri per ampliare i risultati."
                  : "Aggiungi il primo committente per configurare prezzi, clienti e pratiche."
              }
              action={
                !q && status === "active" && economics === "all" ? (
                  <Button size="sm" asChild>
                    <Link to="/committenti/nuovo">Nuovo committente</Link>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          sorted.map((principal) => (
            <Link
              key={principal.id}
              to="/committenti/$principalId"
              params={{ principalId: routeRef(principal) }}
              className={mobileListCardLinkClassName}
            >
              <MobileListCardHeader
                title={principal.business_name}
                subtitle={economicRulesLabel(principal)}
                badge={
                  <Badge variant={principal.archived_at ? "secondary" : "outline"}>
                    {principal.archived_at ? "Archiviato" : "Attivo"}
                  </Badge>
                }
              />
              <MobileListCardDetails
                rows={[
                  {
                    label: "CF / P.IVA",
                    value: principal.vat_number || principal.tax_code || "—",
                  },
                  { label: "Email", value: principal.email ?? "—" },
                  { label: "Città", value: principal.address_city ?? "—" },
                ]}
              />
            </Link>
          ))
        )}
      </div>

      <Card className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                columnKey="business_name"
                label="Ragione sociale"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="economics"
                label="Regole economiche"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="tax" label="CF / P.IVA" sort={sort} onSort={setSort} />
              <SortableTableHead columnKey="email" label="Email" sort={sort} onSort={setSort} />
              <SortableTableHead columnKey="city" label="Città" sort={sort} onSort={setSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  <TableEmptyState
                    title={
                      q || status !== "active" || economics !== "all"
                        ? "Nessun committente trovato"
                        : "Nessun committente"
                    }
                    description={
                      q || status !== "active" || economics !== "all"
                        ? "Modifica ricerca o filtri per ampliare i risultati."
                        : "Aggiungi il primo committente per configurare prezzi, clienti e pratiche."
                    }
                    action={
                      !q && status === "active" && economics === "all" ? (
                        <Button size="sm" asChild>
                          <Link to="/committenti/nuovo">Nuovo committente</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((principal) => (
                <TableRow
                  key={principal.id}
                  className="cursor-pointer"
                  role="link"
                  tabIndex={0}
                  aria-label={`Apri committente ${principal.business_name}`}
                  onClick={(event) =>
                    handleClickableTableRowClick(event, () => openPrincipal(routeRef(principal)))
                  }
                  onKeyDown={(event) =>
                    handleClickableTableRowKeyDown(event, () => openPrincipal(routeRef(principal)))
                  }
                >
                  <TableCell>
                    <Link
                      to="/committenti/$principalId"
                      params={{ principalId: routeRef(principal) }}
                      className="font-medium hover:underline"
                    >
                      {principal.business_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={principal.archived_at ? "secondary" : "outline"}>
                      {principal.archived_at ? "Archiviato" : "Attivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {economicRulesLabel(principal)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {principal.vat_number || principal.tax_code || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {principal.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {principal.address_city ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function economicRulesLabel(principal: {
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
}) {
  if (principal.fees_enabled && principal.expense_reimbursements_enabled) {
    return "Compensi e rimborsi";
  }
  if (principal.fees_enabled) return "Solo compensi";
  if (principal.expense_reimbursements_enabled) return "Solo rimborsi";
  return "Nessuna regola";
}
