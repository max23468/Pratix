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
import { Button } from "@/components/ui/button";
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
import { normalizeTextSearch, parseTextSearch } from "@/lib/search-params";
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
  q?: string;
  view?: PraticheView;
  sort?: PraticheSortKey;
  dir?: "asc" | "desc";
};

type PracticeListRow = {
  id: string;
  public_code: string;
  practice_number: number;
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
  invoice_id: string | null;
  kind: "fee" | "expense_reimbursement";
  // `case_activities.amount` è NOT NULL DEFAULT 0 a schema.
  amount: number;
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
    q: parseTextSearch(search.q),
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
  const q = search.q ?? "";
  const view = search.view ?? "open";
  const urlSort =
    search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, public_code, practice_number, status, opened_at, updated_at, client_id, principal_id, counterparty_id, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
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
        .select("case_id, status, invoice_id, kind, amount, activity_attachments(id)");
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
        label: "Pratica",
        valueType: "number",
        defaultDirection: "desc",
        getValue: (practice) => practice.practice_number,
      },
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
          q: normalizeTextSearch(q),
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
        q: normalizeTextSearch(q),
        view: parsedView === "open" ? undefined : parsedView,
        sort: search.sort,
        dir: search.dir,
      },
      replace: true,
    });
  };

  const updateQuery = (nextQ: string) => {
    navigate({
      search: {
        q: normalizeTextSearch(nextQ),
        view: view === "open" ? undefined : view,
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
        String(c.practice_number).includes(term) ||
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

      <ListToolbar>
        <SearchInput
          placeholder="Cerca per numero, committente, cliente, controparte…"
          value={q}
          onChange={updateQuery}
        />
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
      </ListToolbar>

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={praticheColumns} sort={sort} onSort={setSort} />
      </div>

      <PracticeResults
        isLoading={isLoading}
        rows={sorted}
        q={q}
        view={view}
        activitySummaryByCase={activitySummaryByCase}
        workflowByCase={workflowByCase}
        sort={sort}
        onSort={setSort}
        onOpen={openCase}
      />
    </>
  );
}

type PracticeActivitySummary = { toInvoice: number; invoiced: number; toInvoiceAmount: number };

const emptyPracticeActivitySummary: PracticeActivitySummary = {
  toInvoice: 0,
  invoiced: 0,
  toInvoiceAmount: 0,
};

function practiceBillingLabel(summary: PracticeActivitySummary, withAmount: boolean) {
  if (summary.toInvoice > 0) {
    const base = `${summary.toInvoice} da fatturare`;
    return withAmount ? `${base} · ${formatCurrency(summary.toInvoiceAmount)}` : base;
  }
  return summary.invoiced > 0 ? `${summary.invoiced} fatturate` : "—";
}

function PracticeStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={caseStatusVariant[status] ?? "outline"}>
      {caseStatusLabels[status] ?? status}
    </Badge>
  );
}

function PracticeEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <TableEmptyState
      title={hasFilters ? "Nessuna pratica trovata" : "Nessuna pratica aperta"}
      description={
        hasFilters
          ? "Modifica ricerca, vista o ordinamento per ampliare i risultati."
          : "Crea la prima pratica e collega committente, cliente e controparte."
      }
      action={
        hasFilters ? undefined : (
          <Button size="sm" asChild>
            <Link to="/pratiche/nuova">Nuova pratica</Link>
          </Button>
        )
      }
    />
  );
}

function PracticeWorkflowSummary({ workflow }: { workflow: PracticeWorkflowRow }) {
  return (
    <div className="mt-3 rounded-md border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={workflow.priorityVariant}>{workflow.priorityLabel}</Badge>
        <span className="text-xs text-muted-foreground">{workflow.stage}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{workflow.action}</p>
      <p className="mt-1 text-xs text-muted-foreground">{workflow.reason}</p>
    </div>
  );
}

function PracticeMobileCard({
  practice,
  summary,
  workflow,
}: {
  practice: PracticeListRow;
  summary: PracticeActivitySummary;
  workflow?: PracticeWorkflowRow;
}) {
  return (
    <Link
      to="/pratiche/$caseId"
      params={{ caseId: routeRef(practice) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={practice.practice_number}
        badge={<PracticeStatusBadge status={practice.status} />}
      />
      {workflow ? <PracticeWorkflowSummary workflow={workflow} /> : null}
      <MobileListCardDetails
        rows={[
          { label: "Committente", value: practice.principals?.business_name ?? "—" },
          {
            label: "Cliente",
            value: practice.clients ? clientDisplayName(practice.clients) : "—",
          },
          {
            label: "Controparte",
            value: practice.counterparties ? counterpartyDisplayName(practice.counterparties) : "—",
          },
          { label: "Fatturazione", value: practiceBillingLabel(summary, true) },
          { label: "Aperta il", value: formatDate(practice.opened_at) },
        ]}
      />
    </Link>
  );
}

function PracticeTableRow({
  practice,
  summary,
  onOpen,
}: {
  practice: PracticeListRow;
  summary: PracticeActivitySummary;
  onOpen: () => void;
}) {
  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`Apri pratica ${practice.practice_number}`}
      onClick={(event) => handleClickableTableRowClick(event, onOpen)}
      onKeyDown={(event) => handleClickableTableRowKeyDown(event, onOpen)}
    >
      <TableCell>
        <Link
          to="/pratiche/$caseId"
          params={{ caseId: routeRef(practice) }}
          className="font-medium hover:underline"
        >
          {practice.practice_number}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {practice.principals?.business_name ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {practice.clients ? clientDisplayName(practice.clients) : "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {practice.counterparties ? counterpartyDisplayName(practice.counterparties) : "—"}
      </TableCell>
      <TableCell>
        <PracticeStatusBadge status={practice.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {practiceBillingLabel(summary, false)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(practice.opened_at)}
      </TableCell>
    </TableRow>
  );
}

type PracticeListBodyProps = {
  isLoading: boolean;
  rows: PracticeListRow[];
  hasFilters: boolean;
  activitySummaryByCase: Record<string, PracticeActivitySummary>;
};

function PracticeMobileList({
  isLoading,
  rows,
  hasFilters,
  activitySummaryByCase,
  workflowByCase,
}: PracticeListBodyProps & { workflowByCase: Record<string, PracticeWorkflowRow> }) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <PracticeEmptyState hasFilters={hasFilters} />
      </Card>
    );
  }
  return rows.map((practice) => (
    <PracticeMobileCard
      key={practice.id}
      practice={practice}
      summary={activitySummaryByCase[practice.id] ?? emptyPracticeActivitySummary}
      workflow={workflowByCase[practice.id]}
    />
  ));
}

function PracticeTableBody({
  isLoading,
  rows,
  hasFilters,
  activitySummaryByCase,
  onOpen,
}: PracticeListBodyProps & { onOpen: (caseId: string) => void }) {
  if (isLoading || rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
          {isLoading ? "Caricamento…" : <PracticeEmptyState hasFilters={hasFilters} />}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((practice) => (
    <PracticeTableRow
      key={practice.id}
      practice={practice}
      summary={activitySummaryByCase[practice.id] ?? emptyPracticeActivitySummary}
      onOpen={() => onOpen(routeRef(practice))}
    />
  ));
}

function PracticeTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<PraticheSortKey>;
  onSort: (columnKey: PraticheSortKey) => void;
} & React.ComponentProps<typeof PracticeTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              columnKey="practice_number"
              label="Pratica"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead
              columnKey="principal"
              label="Committente"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead columnKey="client" label="Cliente" sort={sort} onSort={onSort} />
            <SortableTableHead
              columnKey="counterparty"
              label="Controparte"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={onSort} />
            <SortableTableHead
              columnKey="billing"
              label="Fatturazione"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead
              columnKey="opened_at"
              label="Aperta il"
              sort={sort}
              onSort={onSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          <PracticeTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
}

function PracticeResults({
  isLoading,
  rows,
  q,
  view,
  activitySummaryByCase,
  workflowByCase,
  sort,
  onSort,
  onOpen,
}: {
  isLoading: boolean;
  rows: PracticeListRow[];
  q: string;
  view: PraticheView;
  activitySummaryByCase: Record<string, PracticeActivitySummary>;
  workflowByCase: Record<string, PracticeWorkflowRow>;
  sort: TableSort<PraticheSortKey>;
  onSort: (columnKey: PraticheSortKey) => void;
  onOpen: (caseId: string) => void;
}) {
  const bodyProps = {
    isLoading,
    rows,
    hasFilters: !!q || view !== "open",
    activitySummaryByCase,
  };
  return (
    <>
      <div className="space-y-3 md:hidden">
        <PracticeMobileList {...bodyProps} workflowByCase={workflowByCase} />
      </div>
      <PracticeTable {...bodyProps} sort={sort} onSort={onSort} onOpen={onOpen} />
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
