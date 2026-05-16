import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  sort?: ClientiSortKey;
  dir?: "asc" | "desc";
};

type ClientListRow = {
  id: string;
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  tax_code: string | null;
  vat_number: string | null;
  email: string | null;
  address_city: string | null;
  created_at: string;
};

const clientiSortKeys = [
  "name",
  "kind",
  "principals",
  "tax",
  "email",
  "city",
  "created_at",
] as const;

type ClientiSortKey = (typeof clientiSortKeys)[number];

const clientiDefaultSort: TableSort<ClientiSortKey> = { key: "created_at", direction: "desc" };

export const Route = createFileRoute("/clienti/")({
  validateSearch: (search: Record<string, unknown>): ClientiSearch => ({
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

function ClientiList() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [principalId, setPrincipalId] = useState("all");
  const urlSort =
    search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
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

  const principalNamesByClient = useMemo(() => {
    const principalsById = new Map(principals.map((principal) => [principal.id, principal]));
    return principalLinks.reduce<Record<string, string[]>>((acc, link) => {
      const principal = principalsById.get(link.principal_id);
      if (!principal) return acc;
      acc[link.client_id] = [...(acc[link.client_id] ?? []), principal.business_name];
      return acc;
    }, {});
  }, [principalLinks, principals]);

  const clientiColumns = useMemo<readonly SortableColumn<ClientListRow, ClientiSortKey>[]>(
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
        key: "tax",
        label: "CF / P.IVA",
        getValue: (client) => client.vat_number || client.tax_code,
      },
      { key: "email", label: "Email", getValue: (client) => client.email },
      { key: "city", label: "Città", getValue: (client) => client.address_city },
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

  const { sort, setSort } = usePersistentTableSort({
    section: "clienti",
    columns: clientiColumns,
    defaultSort: clientiDefaultSort,
    urlSort,
    onSortChange: (next) =>
      navigate({ search: { sort: next.key, dir: next.direction }, replace: true }),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.filter((c) => {
      if (kind !== "all" && c.kind !== kind) return false;
      if (
        principalId !== "all" &&
        !principalLinks.some((link) => link.client_id === c.id && link.principal_id === principalId)
      ) {
        return false;
      }
      const name = clientDisplayName(c).toLowerCase();
      const principalNames = principalNamesByClient[c.id]?.join(" ").toLowerCase() ?? "";
      if (!term) return true;
      return (
        name.includes(term) ||
        principalNames.includes(term) ||
        (c.tax_code ?? "").toLowerCase().includes(term) ||
        (c.vat_number ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, kind, principalId, principalLinks, principalNamesByClient, q]);

  const sorted = useMemo(
    () => sortRows(filtered, clientiColumns, sort),
    [clientiColumns, filtered, sort],
  );

  const openClient = (clientId: string) =>
    navigate({ to: "/clienti/$clientId", params: { clientId } });

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

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, CF, P.IVA, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={kind} onValueChange={setKind}>
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
        <Select value={principalId} onValueChange={setPrincipalId}>
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
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead columnKey="name" label="Nome" sort={sort} onSort={setSort} />
              <SortableTableHead columnKey="kind" label="Tipo" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="principals"
                label="Committenti"
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
                      q || kind !== "all" || principalId !== "all"
                        ? "Nessun cliente trovato"
                        : "Nessun cliente"
                    }
                    description={
                      q || kind !== "all" || principalId !== "all"
                        ? "Modifica ricerca o filtri per ampliare i risultati."
                        : "Aggiungi il primo cliente e collegalo ai committenti interessati."
                    }
                    action={
                      !q && kind === "all" && principalId === "all" ? (
                        <Button size="sm" asChild>
                          <Link to="/clienti/nuovo">Nuovo cliente</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((c) => {
                const displayName = clientDisplayName(c);
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    role="link"
                    tabIndex={0}
                    aria-label={`Apri cliente ${displayName}`}
                    onClick={(event) => handleClickableTableRowClick(event, () => openClient(c.id))}
                    onKeyDown={(event) =>
                      handleClickableTableRowKeyDown(event, () => openClient(c.id))
                    }
                  >
                    <TableCell>
                      <Link
                        to="/clienti/$clientId"
                        params={{ clientId: c.id }}
                        className="font-medium hover:underline"
                      >
                        {displayName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{clientKindLabels[c.kind] ?? c.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {principalNamesByClient[c.id]?.join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.vat_number || c.tax_code || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.address_city ?? "—"}
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
