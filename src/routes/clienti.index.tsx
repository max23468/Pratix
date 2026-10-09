import {
  type ClientKindFilter,
  type ClientiSortKey,
  type ClientListRow,
  type PrincipalOption,
  type ClientiFilters,
} from "@/components/clients/types";
import {
  type TableSort,
  parseTableSortKey,
  parseTableSortDirection,
  type SortableColumn,
  usePersistentTableSort,
  sortRows,
} from "@/lib/table-sorting";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  parseTextSearch,
  parseSearchValue,
  parseLooseSelectValue,
  normalizeTextSearch,
} from "@/lib/search-params";
import { clientKindFilters, clientiSortKeys } from "@/components/clients/helpers";
import { AppLayout } from "@/components/app-layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { clientDisplayName, clientKindLabels } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClientiToolbar } from "@/components/clients/clienti-toolbar";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { ClientiMobileList } from "@/components/clients/clienti-mobile-list";
import { ClientiTable } from "@/components/clients/clienti-table";

type ClientiSearch = {
  q?: string;
  kind?: ClientKindFilter;
  principalId?: string;
  sort?: ClientiSortKey;
  dir?: "asc" | "desc";
};

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

type PrincipalLink = { client_id: string; principal_id: string };

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
