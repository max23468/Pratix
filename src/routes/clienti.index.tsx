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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableEmptyState } from "@/components/table-empty-state";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { clientDisplayName, clientKindLabels } from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import {
  normalizeTextSearch,
  parseLooseSelectValue,
  parseSearchValue,
  parseTextSearch,
} from "@/lib/search-params";
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

type ClientiSearch = {
  q?: string;
  kind?: ClientKindFilter;
  principalId?: string;
  sort?: ClientiSortKey;
  dir?: "asc" | "desc";
};

type ClientListRow = {
  id: string;
  public_code: string;
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  created_at: string;
};

const clientiSortKeys = ["name", "kind", "principals", "created_at"] as const;

type ClientiSortKey = (typeof clientiSortKeys)[number];

const clientKindFilters = ["all", ...Object.keys(clientKindLabels)] as const;
type ClientKindFilter = (typeof clientKindFilters)[number];

const clientiDefaultSort: TableSort<ClientiSortKey> = { key: "created_at", direction: "desc" };

export const Route = createFileRoute("/clienti/")({
  validateSearch: (search: Record<string, unknown>): ClientiSearch => ({
    q: parseTextSearch(search.q),
    kind: parseSearchValue(search.kind, clientKindFilters),
    principalId: parseLooseSelectValue(search.principalId),
    sort: parseTableSortKey(search.sort, clientiSortKeys),
    dir: parseTableSortDirection(search.dir),
  }),
  head: () => ({
    meta: [
      { title: "Clienti · Pratix" },
      { name: "description", content: "Gestisci la rubrica dei tuoi clienti." },
      { property: "og:title", content: "Clienti · Pratix" },
      { property: "og:description", content: "Gestisci la rubrica dei tuoi clienti." },
    ],
  }),
  component: () => (
    <AppLayout>
      <ClientiList />
    </AppLayout>
  ),
});

type PrincipalOption = { id: string; business_name: string; archived_at: string | null };
type PrincipalLink = { client_id: string; principal_id: string };
type ClientiFilters = { q: string; kind: ClientKindFilter; principalId: string };

function useClientiData() {
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, public_code, kind, first_name, last_name, business_name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientListRow[];
    },
  });

  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "client-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name, archived_at")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: principalLinks = [] } = useQuery({
    queryKey: ["principal-clients", "client-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principal_clients")
        .select("client_id, principal_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  return { data: clients.data, isLoading: clients.isLoading, principals, principalLinks };
}

function usePrincipalNamesByClient(principals: PrincipalOption[], principalLinks: PrincipalLink[]) {
  return useMemo(() => {
    const principalsById = new Map(principals.map((principal) => [principal.id, principal]));
    return principalLinks.reduce<Record<string, string[]>>((acc, link) => {
      const principal = principalsById.get(link.principal_id);
      if (!principal) return acc;
      acc[link.client_id] = [...(acc[link.client_id] ?? []), principal.business_name];
      return acc;
    }, {});
  }, [principalLinks, principals]);
}

function useClientiColumns(principalNamesByClient: Record<string, string[]>) {
  return useMemo<readonly SortableColumn<ClientListRow, ClientiSortKey>[]>(
    () => [
      { key: "name", label: "Nome", getValue: (client) => clientDisplayName(client) },
      {
        key: "kind",
        label: "Tipo",
        getValue: (client) => clientKindLabels[client.kind] ?? client.kind,
      },
      {
        key: "principals",
        label: "Committenti",
        getValue: (client) => principalNamesByClient[client.id]?.join(", ") || null,
      },
      {
        key: "created_at",
        label: "Creazione",
        valueType: "date",
        defaultDirection: "desc",
        getValue: (client) => client.created_at,
      },
    ],
    [principalNamesByClient],
  );
}

function matchesClientFilters(
  client: ClientListRow,
  { q, kind, principalId }: ClientiFilters,
  principalLinks: PrincipalLink[],
  principalNamesByClient: Record<string, string[]>,
) {
  if (kind !== "all" && client.kind !== kind) return false;
  const linkedToPrincipal = principalLinks.some(
    (link) => link.client_id === client.id && link.principal_id === principalId,
  );
  if (principalId !== "all" && !linkedToPrincipal) return false;
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const name = clientDisplayName(client).toLowerCase();
  const principalNames = principalNamesByClient[client.id]?.join(" ").toLowerCase() ?? "";
  return name.includes(term) || principalNames.includes(term);
}

function useFilteredClients(
  data: ClientListRow[] | undefined,
  filters: ClientiFilters,
  principalLinks: PrincipalLink[],
  principalNamesByClient: Record<string, string[]>,
) {
  const { q, kind, principalId } = filters;
  return useMemo(() => {
    if (!data) return [];
    return data.filter((client) =>
      matchesClientFilters(
        client,
        { q, kind, principalId },
        principalLinks,
        principalNamesByClient,
      ),
    );
  }, [data, kind, principalId, principalLinks, principalNamesByClient, q]);
}

function urlSortFromSearch(search: ClientiSearch) {
  return search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;
}

function hasActiveFilters({ q, kind, principalId }: ClientiFilters) {
  return !!q || kind !== "all" || principalId !== "all";
}

function ClientiToolbar({
  filters,
  principals,
  onChange,
}: {
  filters: ClientiFilters;
  principals: PrincipalOption[];
  onChange: (next: ClientiFilters) => void;
}) {
  const { q, kind, principalId } = filters;
  return (
    <ListToolbar>
      <SearchInput
        placeholder="Cerca per nome o committente…"
        value={q}
        onChange={(value) => onChange({ q: value, kind, principalId })}
      />
      <Select
        value={kind}
        onValueChange={(value) => onChange({ q, kind: value as ClientKindFilter, principalId })}
      >
        <SelectTrigger aria-label="Filtra clienti per tipo" className="lg:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i tipi</SelectItem>
          {Object.entries(clientKindLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={principalId}
        onValueChange={(value) => onChange({ q, kind, principalId: value })}
      >
        <SelectTrigger aria-label="Filtra clienti per committente" className="lg:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i committenti</SelectItem>
          {principals.map((principal) => (
            <SelectItem key={principal.id} value={principal.id}>
              {principal.business_name}
              {principal.archived_at ? " (archiviato)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ListToolbar>
  );
}

function ClientiEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <TableEmptyState
      title={hasFilters ? "Nessun cliente trovato" : "Nessun cliente"}
      description={
        hasFilters
          ? "Modifica ricerca o filtri per ampliare i risultati."
          : "Aggiungi il primo cliente e collegalo ai committenti interessati."
      }
      action={
        hasFilters ? undefined : (
          <Button size="sm" asChild>
            <Link to="/clienti/nuovo">Nuovo cliente</Link>
          </Button>
        )
      }
    />
  );
}

function ClientMobileCard({
  client,
  principalNames,
}: {
  client: ClientListRow;
  principalNames?: string[];
}) {
  return (
    <Link
      to="/clienti/$clientId"
      params={{ clientId: routeRef(client) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={clientDisplayName(client)}
        subtitle={principalNames?.join(", ") || "Nessun committente collegato"}
        badge={<Badge variant="outline">{clientKindLabels[client.kind] ?? client.kind}</Badge>}
      />
    </Link>
  );
}

function ClientiMobileList({
  isLoading,
  rows,
  hasFilters,
  principalNamesByClient,
}: {
  isLoading: boolean;
  rows: ClientListRow[];
  hasFilters: boolean;
  principalNamesByClient: Record<string, string[]>;
}) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <ClientiEmptyState hasFilters={hasFilters} />
      </Card>
    );
  }
  return rows.map((client) => (
    <ClientMobileCard
      key={client.id}
      client={client}
      principalNames={principalNamesByClient[client.id]}
    />
  ));
}

function ClientiTableBody({
  isLoading,
  rows,
  hasFilters,
  principalNamesByClient,
  onOpen,
}: {
  isLoading: boolean;
  rows: ClientListRow[];
  hasFilters: boolean;
  principalNamesByClient: Record<string, string[]>;
  onOpen: (clientId: string) => void;
}) {
  if (isLoading || rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
          {isLoading ? "Caricamento…" : <ClientiEmptyState hasFilters={hasFilters} />}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((client) => (
    <ClientTableRow
      key={client.id}
      client={client}
      principalNames={principalNamesByClient[client.id]}
      onOpen={() => onOpen(routeRef(client))}
    />
  ));
}

function ClientiTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<ClientiSortKey>;
  onSort: (key: ClientiSortKey) => void;
} & React.ComponentProps<typeof ClientiTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead columnKey="name" label="Nome" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="kind" label="Tipo" sort={sort} onSort={onSort} />
            <SortableTableHead
              columnKey="principals"
              label="Committenti"
              sort={sort}
              onSort={onSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          <ClientiTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
}

function ClientiList() {
  const navigate = Route.useNavigate();
  const routeSearch = Route.useSearch();
  const q = routeSearch.q ?? "";
  const kind = routeSearch.kind ?? "all";
  const principalId = routeSearch.principalId ?? "all";
  const urlSort = urlSortFromSearch(routeSearch);

  const updateSearch = (next: ClientiSearch) =>
    navigate({
      search: {
        q: normalizeTextSearch(next.q ?? q),
        kind: next.kind && next.kind !== "all" ? next.kind : undefined,
        principalId: next.principalId && next.principalId !== "all" ? next.principalId : undefined,
        sort: next.sort ?? routeSearch.sort,
        dir: next.dir ?? routeSearch.dir,
      },
      replace: true,
    });

  const { data, isLoading, principals, principalLinks } = useClientiData();
  const principalNamesByClient = usePrincipalNamesByClient(principals, principalLinks);
  const clientiColumns = useClientiColumns(principalNamesByClient);

  const { sort, setSort } = usePersistentTableSort({
    section: "clienti",
    columns: clientiColumns,
    defaultSort: clientiDefaultSort,
    urlSort,
    onSortChange: (next) =>
      updateSearch({ q, kind, principalId, sort: next.key, dir: next.direction }),
  });

  const filters = { q, kind, principalId };
  const filtered = useFilteredClients(data, filters, principalLinks, principalNamesByClient);
  const sorted = useMemo(
    () => sortRows(filtered, clientiColumns, sort),
    [clientiColumns, filtered, sort],
  );
  const hasFilters = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Clienti"
        description="Gestisci l'anagrafica dei clienti collegati ai committenti."
        actions={
          <Link to="/clienti/nuovo">
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Nuovo cliente
            </Button>
          </Link>
        }
      />

      <ClientiToolbar filters={filters} principals={principals} onChange={updateSearch} />

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={clientiColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        <ClientiMobileList
          isLoading={isLoading}
          rows={sorted}
          hasFilters={hasFilters}
          principalNamesByClient={principalNamesByClient}
        />
      </div>

      <ClientiTable
        sort={sort}
        onSort={setSort}
        isLoading={isLoading}
        rows={sorted}
        hasFilters={hasFilters}
        principalNamesByClient={principalNamesByClient}
        onOpen={(clientId) => navigate({ to: "/clienti/$clientId", params: { clientId } })}
      />
    </>
  );
}

function ClientTableRow({
  client,
  principalNames,
  onOpen,
}: {
  client: ClientListRow;
  principalNames?: string[];
  onOpen: () => void;
}) {
  const displayName = clientDisplayName(client);
  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`Apri cliente ${displayName}`}
      onClick={(event) => handleClickableTableRowClick(event, onOpen)}
      onKeyDown={(event) => handleClickableTableRowKeyDown(event, onOpen)}
    >
      <TableCell>
        <span className="font-medium">{displayName}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{clientKindLabels[client.kind] ?? client.kind}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {principalNames?.join(", ") || "—"}
      </TableCell>
    </TableRow>
  );
}
