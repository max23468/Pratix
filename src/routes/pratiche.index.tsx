import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { PageHeader } from "@/components/page-header";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableEmptyState } from "@/components/table-empty-state";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  caseStatusLabels,
  caseStatusVariant,
  clientDisplayName,
  counterpartyDisplayName,
} from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  buildCaseWorkflowQualityChecks,
  buildDebtCollectionWorkflow,
  formatCaseWorkflowPriorityLabel,
  summarizeCaseOperations,
  type CaseDebtCollectionWorkflow,
} from "@/lib/case-workflow";
import { routeRef } from "@/lib/public-route-code";
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

type PraticheSearch = {
  view?: PraticheView;
  sort?: PraticheSortKey;
  dir?: "asc" | "desc";
};

type PracticeListRow = {
  id: string;
  public_code: string;
  case_number: string;
  practice_number: number;
  title: string;
  status: string;
  opened_at: string;
  updated_at: string;
  client_id: string | null;
  principal_id: string | null;
  counterparty_id: string | null;
  principals: { business_name: string } | null;
  clients: {
    kind: string;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
  } | null;
  counterparties: {
    kind: string;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
  } | null;
};

type PracticeActivityRow = {
  case_id: string;
  status: "to_invoice" | "invoiced";
  kind: "fee" | "expense_reimbursement";
  amount: number | null;
  activity_attachments?: { id: string }[] | null;
};

type PracticeInvoiceRow = {
  case_id: string | null;
  status: "draft" | "issued" | "paid" | "overdue";
  due_date: string | null;
  total_amount: number;
};

type PracticeWorkflowRow = {
  stage: string;
  action: string;
  reason: string;
  priorityLabel: string;
  priorityVariant: CaseDebtCollectionWorkflow["priorityVariant"];
};

const praticheSortKeys = [
  "practice_number",
  "title",
  "principal",
  "client",
  "counterparty",
  "status",
  "billing",
  "opened_at",
  "updated_at",
] as const;

type PraticheSortKey = (typeof praticheSortKeys)[number];

const praticheDefaultSort: TableSort<PraticheSortKey> = { key: "updated_at", direction: "desc" };

const praticheViewKeys = [
  "all",
  "open",
  "without_activities",
  "to_complete",
  "to_invoice",
  "invoiced",
  "suspended",
  "closed",
  "archived",
] as const;

type PraticheView = (typeof praticheViewKeys)[number];

export const Route = createFileRoute("/pratiche/")({
  validateSearch: (search: Record<string, unknown>): PraticheSearch => ({
    view: parsePracticeView(search.view),
    sort: parseTableSortKey(search.sort, praticheSortKeys),
    dir: parseTableSortDirection(search.dir),
  }),
  head: () => ({
    meta: [
      { title: "Pratiche · Pratix" },
      { name: "description", content: "Tutte le tue pratiche in un unico posto." },
      { property: "og:title", content: "Pratiche · Pratix" },
      { property: "og:description", content: "Tutte le tue pratiche in un unico posto." },
    ],
  }),
  component: () => (
    <AppLayout>
      <PraticheList />
    </AppLayout>
  ),
});

function PraticheList() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const view = search.view ?? "open";
  const urlSort =
    search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, public_code, case_number, practice_number, title, status, opened_at, updated_at, client_id, principal_id, counterparty_id, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PracticeListRow[];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["case-activity-statuses", "case-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activities")
        .select("case_id, status, kind, amount, activity_attachments(id)");
      if (error) throw error;
      return (data ?? []) as PracticeActivityRow[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["case-invoice-statuses", "case-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("case_id, status, due_date, total_amount");
      if (error) throw error;
      return (data ?? []) as PracticeInvoiceRow[];
    },
  });

  const activitiesByCase = useMemo(
    () =>
      activities.reduce<Record<string, PracticeActivityRow[]>>((acc, activity) => {
        const current = acc[activity.case_id] ?? [];
        current.push(activity);
        acc[activity.case_id] = current;
        return acc;
      }, {}),
    [activities],
  );

  const invoicesByCase = useMemo(
    () =>
      invoices.reduce<Record<string, PracticeInvoiceRow[]>>((acc, invoice) => {
        if (!invoice.case_id) return acc;
        const current = acc[invoice.case_id] ?? [];
        current.push(invoice);
        acc[invoice.case_id] = current;
        return acc;
      }, {}),
    [invoices],
  );

  const activitySummaryByCase = useMemo(() => {
    return activities.reduce<
      Record<string, { toInvoice: number; invoiced: number; toInvoiceAmount: number }>
    >((acc, activity) => {
      const current = acc[activity.case_id] ?? { toInvoice: 0, invoiced: 0, toInvoiceAmount: 0 };
      if (activity.status === "to_invoice") {
        current.toInvoice += 1;
        current.toInvoiceAmount += Number(activity.amount ?? 0);
      }
      if (activity.status === "invoiced") current.invoiced += 1;
      acc[activity.case_id] = current;
      return acc;
    }, {});
  }, [activities]);

  const workflowByCase = useMemo(() => {
    return (data ?? []).reduce<Record<string, PracticeWorkflowRow>>((acc, practice) => {
      acc[practice.id] = buildPracticeWorkflow(
        practice,
        activitiesByCase[practice.id] ?? [],
        invoicesByCase[practice.id] ?? [],
      );
      return acc;
    }, {});
  }, [activitiesByCase, data, invoicesByCase]);

  const praticheColumns = useMemo<readonly SortableColumn<PracticeListRow, PraticheSortKey>[]>(
    () => [
      {
        key: "practice_number",
        label: "Numero",
        valueType: "number",
        defaultDirection: "desc",
        getValue: (practice) => practice.practice_number,
      },
      { key: "title", label: "Pratica", getValue: (practice) => practice.title },
      {
        key: "principal",
        label: "Committente",
        getValue: (practice) => practice.principals?.business_name,
      },
      {
        key: "client",
        label: "Cliente",
        getValue: (practice) => (practice.clients ? clientDisplayName(practice.clients) : null),
      },
      {
        key: "counterparty",
        label: "Controparte",
        getValue: (practice) =>
          practice.counterparties ? counterpartyDisplayName(practice.counterparties) : null,
      },
      {
        key: "status",
        label: "Stato",
        getValue: (practice) => caseStatusLabels[practice.status] ?? practice.status,
      },
      {
        key: "billing",
        label: "Fatturazione",
        valueType: "number",
        defaultDirection: "desc",
        getValue: (practice) => activitySummaryByCase[practice.id]?.toInvoiceAmount ?? 0,
      },
      {
        key: "opened_at",
        label: "Aperta il",
        valueType: "date",
        defaultDirection: "desc",
        getValue: (practice) => practice.opened_at,
      },
      {
        key: "updated_at",
        label: "Aggiornamento",
        valueType: "date",
        defaultDirection: "desc",
        getValue: (practice) => practice.updated_at,
      },
    ],
    [activitySummaryByCase],
  );

  const { sort, setSort } = usePersistentTableSort({
    section: "pratiche",
    columns: praticheColumns,
    defaultSort: praticheDefaultSort,
    urlSort,
    onSortChange: (next) =>
      navigate({
        search: {
          view: view === "open" ? undefined : view,
          sort: next.key,
          dir: next.direction,
        },
        replace: true,
      }),
  });

  const updateView = (nextView: string) => {
    const parsedView = parsePracticeView(nextView) ?? "open";
    navigate({
      search: {
        view: parsedView === "open" ? undefined : parsedView,
        sort: search.sort,
        dir: search.dir,
      },
      replace: true,
    });
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.filter((c) => {
      const summary = activitySummaryByCase[c.id] ?? {
        toInvoice: 0,
        invoiced: 0,
        toInvoiceAmount: 0,
      };
      const isOperational = c.status !== "closed" && c.status !== "archived";
      const hasActivities = c.id in activitySummaryByCase;
      if (view === "open" && c.status !== "open" && c.status !== "in_progress") return false;
      if (view === "without_activities" && (!isOperational || hasActivities)) return false;
      if (
        view === "to_complete" &&
        (!isOperational || !hasActivities || (c.principal_id && c.client_id && c.counterparty_id))
      ) {
        return false;
      }
      if (view === "to_invoice" && summary.toInvoice === 0) return false;
      if (view === "invoiced" && summary.invoiced === 0) return false;
      if (view === "suspended" && c.status !== "suspended") return false;
      if (view === "closed" && c.status !== "closed") return false;
      if (view === "archived" && c.status !== "archived") return false;
      if (!term) return true;
      const clientName = c.clients ? clientDisplayName(c.clients).toLowerCase() : "";
      const principalName = c.principals?.business_name?.toLowerCase() ?? "";
      const counterpartyName = c.counterparties
        ? counterpartyDisplayName(c.counterparties).toLowerCase()
        : "";
      return (
        c.title.toLowerCase().includes(term) ||
        c.case_number.toLowerCase().includes(term) ||
        clientName.includes(term) ||
        principalName.includes(term) ||
        counterpartyName.includes(term)
      );
    });
  }, [activitySummaryByCase, data, q, view]);

  const sorted = useMemo(
    () => sortRows(filtered, praticheColumns, sort),
    [filtered, praticheColumns, sort],
  );

  const openCase = (caseId: string) => navigate({ to: "/pratiche/$caseId", params: { caseId } });

  return (
    <>
      <PageHeader
        title="Pratiche"
        description="Controlla pratiche, soggetti collegati e attività da fatturare."
        actions={
          <Link to="/pratiche/nuova">
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Nuova pratica
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per numero, committente, cliente, controparte…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={view} onValueChange={updateView}>
          <SelectTrigger aria-label="Filtra pratiche per vista" className="lg:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le pratiche</SelectItem>
            <SelectItem value="open">Aperte e in corso</SelectItem>
            <SelectItem value="without_activities">Senza attività</SelectItem>
            <SelectItem value="to_complete">Da completare</SelectItem>
            <SelectItem value="to_invoice">Con attività da fatturare</SelectItem>
            <SelectItem value="invoiced">Con attività fatturate</SelectItem>
            <SelectItem value="suspended">Sospese</SelectItem>
            <SelectItem value="closed">Chiuse</SelectItem>
            <SelectItem value="archived">Archiviate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={praticheColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>
        ) : sorted.length === 0 ? (
          <Card className="p-4">
            <TableEmptyState
              title={q || view !== "open" ? "Nessuna pratica trovata" : "Nessuna pratica aperta"}
              description={
                q || view !== "open"
                  ? "Modifica ricerca, vista o ordinamento per ampliare i risultati."
                  : "Crea la prima pratica e collega committente, cliente e controparte."
              }
              action={
                !q && view === "open" ? (
                  <Button size="sm" asChild>
                    <Link to="/pratiche/nuova">Nuova pratica</Link>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          sorted.map((c) => {
            const summary = activitySummaryByCase[c.id] ?? {
              toInvoice: 0,
              invoiced: 0,
              toInvoiceAmount: 0,
            };
            const workflow = workflowByCase[c.id];
            return (
              <Link
                key={c.id}
                to="/pratiche/$caseId"
                params={{ caseId: routeRef(c) }}
                className="block rounded-md border border-border bg-card p-4 shadow-soft transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      Pratica {c.practice_number}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{c.title}</p>
                  </div>
                  <Badge variant={caseStatusVariant[c.status] ?? "outline"} className="shrink-0">
                    {caseStatusLabels[c.status] ?? c.status}
                  </Badge>
                </div>
                {workflow ? (
                  <div className="mt-3 rounded-md border border-border/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={workflow.priorityVariant}>{workflow.priorityLabel}</Badge>
                      <span className="text-xs text-muted-foreground">{workflow.stage}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">{workflow.action}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{workflow.reason}</p>
                  </div>
                ) : null}
                <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt>Committente</dt>
                    <dd className="min-w-0 truncate text-right">
                      {c.principals?.business_name ?? "—"}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt>Cliente</dt>
                    <dd className="min-w-0 truncate text-right">
                      {c.clients ? clientDisplayName(c.clients) : "—"}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt>Controparte</dt>
                    <dd className="min-w-0 truncate text-right">
                      {c.counterparties ? counterpartyDisplayName(c.counterparties) : "—"}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt>Fatturazione</dt>
                    <dd className="min-w-0 truncate text-right">
                      {summary.toInvoice > 0
                        ? `${summary.toInvoice} da fatturare · ${formatCurrency(summary.toInvoiceAmount)}`
                        : summary.invoiced > 0
                          ? `${summary.invoiced} fatturate`
                          : "—"}
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt>Aperta il</dt>
                    <dd className="text-right">{formatDate(c.opened_at)}</dd>
                  </div>
                </dl>
              </Link>
            );
          })
        )}
      </div>

      <Card className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                columnKey="practice_number"
                label="Numero"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="title" label="Pratica" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="principal"
                label="Committente"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="client" label="Cliente" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="counterparty"
                label="Controparte"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="billing"
                label="Fatturazione"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead
                columnKey="opened_at"
                label="Aperta il"
                sort={sort}
                onSort={setSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  <TableEmptyState
                    title={
                      q || view !== "open" ? "Nessuna pratica trovata" : "Nessuna pratica aperta"
                    }
                    description={
                      q || view !== "open"
                        ? "Modifica ricerca, vista o ordinamento per ampliare i risultati."
                        : "Crea la prima pratica e collega committente, cliente e controparte."
                    }
                    action={
                      !q && view === "open" ? (
                        <Button size="sm" asChild>
                          <Link to="/pratiche/nuova">Nuova pratica</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((c) => {
                const summary = activitySummaryByCase[c.id] ?? {
                  toInvoice: 0,
                  invoiced: 0,
                  toInvoiceAmount: 0,
                };
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    role="link"
                    tabIndex={0}
                    aria-label={`Apri pratica ${c.practice_number}`}
                    onClick={(event) =>
                      handleClickableTableRowClick(event, () => openCase(routeRef(c)))
                    }
                    onKeyDown={(event) =>
                      handleClickableTableRowKeyDown(event, () => openCase(routeRef(c)))
                    }
                  >
                    <TableCell className="font-mono text-sm">{c.practice_number}</TableCell>
                    <TableCell>
                      <Link
                        to="/pratiche/$caseId"
                        params={{ caseId: routeRef(c) }}
                        className="font-medium hover:underline"
                      >
                        {c.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.principals?.business_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.clients ? clientDisplayName(c.clients) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.counterparties ? counterpartyDisplayName(c.counterparties) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={caseStatusVariant[c.status] ?? "outline"}>
                        {caseStatusLabels[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {summary.toInvoice > 0
                        ? `${summary.toInvoice} da fatturare`
                        : summary.invoiced > 0
                          ? `${summary.invoiced} fatturate`
                          : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.opened_at)}
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

function buildPracticeWorkflow(
  practice: PracticeListRow,
  activities: PracticeActivityRow[],
  invoices: PracticeInvoiceRow[],
) {
  const totals = summarizeCaseOperations(activities, invoices);
  const qualityChecks = buildCaseWorkflowQualityChecks({
    caseRow: practice,
    activities,
    invoices,
    totals,
  });
  const workflow = buildDebtCollectionWorkflow({
    caseRow: practice,
    activities,
    invoices,
    totals,
    qualityChecks,
  });

  return {
    stage: workflow.stage,
    action: workflow.action,
    reason: workflow.reason,
    priorityLabel: formatCaseWorkflowPriorityLabel(workflow.priority),
    priorityVariant: workflow.priorityVariant,
  } satisfies PracticeWorkflowRow;
}

function parsePracticeView(value: unknown): PraticheView | undefined {
  if (typeof value !== "string") return undefined;
  return praticheViewKeys.includes(value as PraticheView) ? (value as PraticheView) : undefined;
}
