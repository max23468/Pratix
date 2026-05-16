import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { CaseActivityDialog, type CaseActivityDialogActivity } from "@/components/case-activities";
import { MobileSortSelect } from "@/components/mobile-sort-select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { activityCaseLabel, type CaseActivityContext } from "@/lib/case-activities";
import { formatCurrency, formatDate } from "@/lib/format";
import { routeRef } from "@/lib/public-route-code";
import {
  caseActivityStatusLabels,
  caseActivityStatusVariant,
  priceItemKindLabels,
} from "@/lib/labels";
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

const attivitaSortKeys = [
  "activity_date",
  "case",
  "activity",
  "status",
  "quantity",
  "amount",
] as const;

type AttivitaSortKey = (typeof attivitaSortKeys)[number];

const attivitaDefaultSort: TableSort<AttivitaSortKey> = {
  key: "activity_date",
  direction: "desc",
};

export const Route = createFileRoute("/attivita/")({
  validateSearch: (search: Record<string, unknown>): ActivitiesSearch => ({
    q: parseTextSearch(search.q),
    status: parseFilterValue(search.status, caseActivityStatusLabels),
    kind: parseFilterValue(search.kind, priceItemKindLabels),
    sort: parseTableSortKey(search.sort, attivitaSortKeys),
    dir: parseTableSortDirection(search.dir),
  }),
  head: () => ({
    meta: [
      { title: "Attività · Pratix" },
      {
        name: "description",
        content: "Inserisci e controlla compensi e rimborsi spese delle pratiche.",
      },
      { property: "og:title", content: "Attività · Pratix" },
      {
        property: "og:description",
        content: "Inserisci e controlla compensi e rimborsi spese delle pratiche.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <ActivitiesList />
    </AppLayout>
  ),
});

type ActivitiesSearch = {
  q?: string;
  status?: string;
  kind?: string;
  sort?: AttivitaSortKey;
  dir?: "asc" | "desc";
};

type GlobalActivityRow = CaseActivityDialogActivity & {
  cases:
    | (CaseActivityContext & { public_code: string; practice_number: number; title: string })
    | null;
};

function ActivitiesList() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const q = search.q ?? "";
  const status = search.status ?? "all";
  const kind = search.kind ?? "all";
  const urlSort =
    search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;

  const updateSearch = (next: ActivitiesSearch) =>
    navigate({
      search: {
        q: next.q?.trim() ? next.q : undefined,
        status: next.status && next.status !== "all" ? next.status : undefined,
        kind: next.kind && next.kind !== "all" ? next.kind : undefined,
        sort: next.sort ?? search.sort,
        dir: next.dir ?? search.dir,
      },
      replace: true,
    });

  const openCase = (caseId: string) => navigate({ to: "/pratiche/$caseId", params: { caseId } });

  const { data = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activities")
        .select(
          "id, case_id, price_book_id, price_item_id, activity_date, kind, status, snapshot_price_year, snapshot_price_code, snapshot_price_name, description, quantity, unit_price, amount, invoice_id, notes, case_activity_hearings(*), activity_attachments(*), cases(id, public_code, practice_number, case_number, title, principal_id, client_id, counterparty_id, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name))",
        )
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GlobalActivityRow[];
    },
  });

  const attivitaColumns = useMemo<readonly SortableColumn<GlobalActivityRow, AttivitaSortKey>[]>(
    () => [
      {
        key: "activity_date",
        label: "Data",
        valueType: "date",
        defaultDirection: "desc",
        getValue: (activity) => activity.activity_date,
      },
      {
        key: "case",
        label: "Pratica",
        valueType: "number",
        getValue: (activity) => activity.cases?.practice_number,
      },
      { key: "activity", label: "Attività", getValue: (activity) => activity.description },
      {
        key: "status",
        label: "Stato",
        getValue: (activity) => caseActivityStatusLabels[activity.status] ?? activity.status,
      },
      {
        key: "quantity",
        label: "Quantità",
        valueType: "number",
        getValue: (activity) => activity.quantity,
      },
      {
        key: "amount",
        label: "Totale",
        valueType: "number",
        defaultDirection: "desc",
        getValue: (activity) => activity.amount,
      },
    ],
    [],
  );

  const { sort, setSort } = usePersistentTableSort({
    section: "attivita",
    columns: attivitaColumns,
    defaultSort: attivitaDefaultSort,
    urlSort,
    onSortChange: (next) => updateSearch({ q, status, kind, sort: next.key, dir: next.direction }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((activity) => {
      if (status !== "all" && activity.status !== status) return false;
      if (kind !== "all" && activity.kind !== kind) return false;
      if (!term) return true;

      const caseLabel = activity.cases ? activityCaseLabel(activity.cases).toLowerCase() : "";
      return (
        activity.description.toLowerCase().includes(term) ||
        activity.snapshot_price_name.toLowerCase().includes(term) ||
        caseLabel.includes(term)
      );
    });
  }, [data, kind, q, status]);

  const sorted = useMemo(
    () => sortRows(filtered, attivitaColumns, sort),
    [attivitaColumns, filtered, sort],
  );

  const totals = filtered.reduce(
    (acc, activity) => {
      const amount = Number(activity.amount) || 0;
      if (activity.kind === "fee") acc.fees += amount;
      else acc.reimbursements += amount;
      if (activity.status === "to_invoice") acc.toInvoice += amount;
      return acc;
    },
    { fees: 0, reimbursements: 0, toInvoice: 0 },
  );

  return (
    <>
      <PageHeader
        title="Attività"
        description="Inserimento rapido e controllo delle voci fatturabili delle pratiche."
        actions={
          <CaseActivityDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-1 size-4" /> Nuova attività
              </Button>
            }
          />
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <SummaryTile label="Compensi" value={totals.fees} />
        <SummaryTile label="Rimborsi spese" value={totals.reimbursements} />
        <SummaryTile label="Da fatturare" value={totals.toInvoice} />
      </div>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per pratica, voce, committente, cliente…"
            value={q}
            onChange={(event) => updateSearch({ q: event.target.value, status, kind })}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(value) => updateSearch({ q, status: value, kind })}>
          <SelectTrigger aria-label="Filtra attività per stato" className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(caseActivityStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(value) => updateSearch({ q, status, kind: value })}>
          <SelectTrigger aria-label="Filtra attività per tipo" className="lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {Object.entries(priceItemKindLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={attivitaColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>
        ) : sorted.length === 0 ? (
          <Card className="p-4">
            <TableEmptyState
              title={
                q || status !== "all" || kind !== "all"
                  ? "Nessuna attività trovata"
                  : "Nessuna attività"
              }
              description={
                q || status !== "all" || kind !== "all"
                  ? "Modifica ricerca o filtri per ampliare i risultati."
                  : "Registra compensi o rimborsi spese dalla pratica o da inserimento rapido."
              }
              action={
                !q && status === "all" && kind === "all" ? (
                  <CaseActivityDialog
                    trigger={
                      <Button size="sm">
                        <Plus className="mr-1 size-4" /> Nuova attività
                      </Button>
                    }
                  />
                ) : undefined
              }
            />
          </Card>
        ) : (
          sorted.map((activity) => {
            const caseRef = activity.cases ? routeRef(activity.cases) : null;
            const editTitle = activity.invoice_id
              ? "Le voci collegate a una Fattura non si modificano"
              : "Modifica voce";
            return (
              <Card key={activity.id} className="p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(activity.activity_date)}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {activity.description}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {priceItemKindLabels[activity.kind]} · {activity.snapshot_price_name}
                    </p>
                  </div>
                  <Badge
                    variant={caseActivityStatusVariant[activity.status] ?? "outline"}
                    className="shrink-0"
                  >
                    {caseActivityStatusLabels[activity.status] ?? activity.status}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt>Pratica</dt>
                    <dd className="min-w-0 truncate text-right">
                      {activity.cases ? activityCaseLabel(activity.cases) : "—"}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt>Quantità</dt>
                    <dd className="text-right">{activity.quantity}</dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt>Totale</dt>
                    <dd className="text-right font-medium text-foreground">
                      {formatCurrency(Number(activity.amount))}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  {caseRef && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/pratiche/$caseId" params={{ caseId: caseRef }}>
                        Apri pratica
                      </Link>
                    </Button>
                  )}
                  <CaseActivityDialog
                    caseRow={activity.cases ?? undefined}
                    activity={activity}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(activity.invoice_id)}
                        title={editTitle}
                      >
                        <Pencil className="mr-1 size-4" />
                        Modifica
                      </Button>
                    }
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                columnKey="activity_date"
                label="Data"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="case" label="Pratica" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="activity"
                label="Attività"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="quantity"
                label="Quantità"
                sort={sort}
                onSort={setSort}
                align="right"
                className="text-right"
              />
              <SortableTableHead
                columnKey="amount"
                label="Totale"
                sort={sort}
                onSort={setSort}
                align="right"
                className="text-right"
              />
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <TableEmptyState
                    title={
                      q || status !== "all" || kind !== "all"
                        ? "Nessuna attività trovata"
                        : "Nessuna attività"
                    }
                    description={
                      q || status !== "all" || kind !== "all"
                        ? "Modifica ricerca o filtri per ampliare i risultati."
                        : "Registra compensi o rimborsi spese dalla pratica o da inserimento rapido."
                    }
                    action={
                      !q && status === "all" && kind === "all" ? (
                        <CaseActivityDialog
                          trigger={
                            <Button size="sm">
                              <Plus className="mr-1 size-4" /> Nuova attività
                            </Button>
                          }
                        />
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((activity) => {
                const caseRef = activity.cases ? routeRef(activity.cases) : null;
                const editTitle = activity.invoice_id
                  ? "Le voci collegate a una Fattura non si modificano"
                  : "Modifica voce";
                return (
                  <TableRow
                    key={activity.id}
                    className={caseRef ? "cursor-pointer" : undefined}
                    role={caseRef ? "link" : undefined}
                    tabIndex={caseRef ? 0 : undefined}
                    aria-label={
                      caseRef ? `Apri pratica ${activity.cases?.practice_number}` : undefined
                    }
                    onClick={
                      caseRef
                        ? (event) => handleClickableTableRowClick(event, () => openCase(caseRef))
                        : undefined
                    }
                    onKeyDown={
                      caseRef
                        ? (event) => handleClickableTableRowKeyDown(event, () => openCase(caseRef))
                        : undefined
                    }
                  >
                    <TableCell className="text-sm">{formatDate(activity.activity_date)}</TableCell>
                    <TableCell className="text-sm">
                      {activity.cases ? (
                        <Link
                          to="/pratiche/$caseId"
                          params={{ caseId: routeRef(activity.cases) }}
                          className="hover:underline"
                        >
                          <div className="font-medium">
                            Pratica {activity.cases.practice_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.cases.title}
                          </div>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <CaseActivityDialog
                        caseRow={activity.cases ?? undefined}
                        activity={activity}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto max-w-full justify-start px-0 py-0 text-left hover:bg-transparent"
                            disabled={Boolean(activity.invoice_id)}
                            aria-label={`Modifica ${activity.description}`}
                            title={editTitle}
                          >
                            <span className="flex min-w-0 flex-col gap-1">
                              <span className="truncate font-medium">{activity.description}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {priceItemKindLabels[activity.kind]} ·{" "}
                                {activity.snapshot_price_name}
                              </span>
                            </span>
                          </Button>
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={caseActivityStatusVariant[activity.status] ?? "outline"}>
                        {caseActivityStatusLabels[activity.status] ?? activity.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{activity.quantity}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(Number(activity.amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      <CaseActivityDialog
                        caseRow={activity.cases ?? undefined}
                        activity={activity}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={Boolean(activity.invoice_id)}
                            aria-label={`Modifica ${activity.description}`}
                            title={editTitle}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
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

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}

function parseTextSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 120);
  return normalized || undefined;
}

function parseFilterValue(value: unknown, labels: Record<string, string>) {
  if (typeof value !== "string") return undefined;
  return value in labels ? value : undefined;
}
