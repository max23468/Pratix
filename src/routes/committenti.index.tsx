import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  sort?: CommittentiSortKey;
  dir?: "asc" | "desc";
};

type PrincipalListRow = {
  id: string;
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
  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [economics, setEconomics] = useState("all");
  const urlSort =
    search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["principals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select(
          "id, business_name, tax_code, vat_number, email, address_city, fees_enabled, expense_reimbursements_enabled, archived_at, created_at",
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
      navigate({ search: { sort: next.key, dir: next.direction }, replace: true }),
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

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per ragione sociale, CF, P.IVA, email…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtra committenti per stato" className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivi</SelectItem>
            <SelectItem value="archived">Archiviati</SelectItem>
          </SelectContent>
        </Select>
        <Select value={economics} onValueChange={setEconomics}>
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
      </div>

      <Card>
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
                    handleClickableTableRowClick(event, () => openPrincipal(principal.id))
                  }
                  onKeyDown={(event) =>
                    handleClickableTableRowKeyDown(event, () => openPrincipal(principal.id))
                  }
                >
                  <TableCell>
                    <Link
                      to="/committenti/$principalId"
                      params={{ principalId: principal.id }}
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
