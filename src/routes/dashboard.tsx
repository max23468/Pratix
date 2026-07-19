import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Briefcase, FileWarning, ListChecks, Receipt } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { CreateMenu } from "@/components/dashboard/create-menu";
import { DuplicateSummaryBox } from "@/components/dashboard/duplicate-summary-box";
import { StatCard } from "@/components/dashboard/stat-card";
import type { DuplicateSummary, WorkQueueItem } from "@/components/dashboard/types";
import { WorkQueueCard } from "@/components/dashboard/work-queue-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableEmptyState } from "@/components/table-empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import {
  caseStatusLabels,
  caseStatusVariant,
  clientDisplayName,
  counterpartyDisplayName,
  practiceDisplayName,
  type ClientDisplayData,
  type CounterpartyDisplayData,
} from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import { getAuthHeaders, readServerResult } from "@/lib/server-functions";
import {
  buildCaseWorkflowQualityChecks,
  buildDebtCollectionWorkflow,
  formatCaseWorkflowPriorityLabel,
  summarizeCaseOperations,
  type CaseDebtCollectionWorkflow,
} from "@/lib/case-workflow";
import { getDuplicateSummaryFn } from "@/server/duplicates.functions";

type DashboardCaseRow = {
  id: string;
  public_code: string | null;
  practice_number: number;
  status: string;
  updated_at: string;
  principal_id: string | null;
  client_id: string | null;
  counterparty_id: string | null;
};

type DashboardActivityRow = {
  id: string;
  case_id: string;
  kind: "fee" | "expense_reimbursement";
  // `case_activities.amount` è NOT NULL DEFAULT 0 a schema.
  amount: number;
  principal_id: string;
  status: "to_invoice" | "invoiced";
  invoice_id: string | null;
  activity_attachments?: { id: string }[] | null;
};

type DashboardInvoiceRow = {
  id: string;
  case_id: string | null;
  number: string;
  year: number;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  status: "draft" | "issued" | "paid" | "overdue";
  total_amount: number;
  net_to_pay: number;
  notes: string | null;
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Pratix" },
      {
        name: "description",
        content: "Pratiche, attività, fatture e rimborsi da tenere sotto controllo.",
      },
      { property: "og:title", content: "Dashboard · Pratix" },
      {
        property: "og:description",
        content: "Pratiche, attività, fatture e rimborsi da tenere sotto controllo.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  ),
});

function DashboardContent() {
  const { user } = useAuth();
  const userId = user?.id;
  const getDuplicateSummary = useServerFn(getDuplicateSummaryFn);

  const { data, isLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["dashboard", userId],
    queryFn: async () => {
      const [casesRes, activitiesRes, invoicesRes, recentCasesRes, principalsRes] =
        await Promise.all([
          supabase
            .from("cases")
            .select(
              "id, public_code, practice_number, status, updated_at, principal_id, client_id, counterparty_id",
            ),
          supabase
            .from("case_activities")
            .select(
              "id, case_id, kind, amount, principal_id, status, invoice_id, activity_attachments(id)",
            ),
          supabase
            .from("invoices")
            .select(
              "id, case_id, number, year, issue_date, due_date, paid_at, status, total_amount, net_to_pay, notes",
            ),
          supabase
            .from("cases")
            .select(
              "id, public_code, practice_number, status, updated_at, principal:principals(business_name), client:clients(kind, first_name, last_name, business_name), counterparty:counterparties(kind, first_name, last_name, business_name)",
            )
            .order("updated_at", { ascending: false })
            .limit(5),
          supabase.from("principals").select("id, business_name"),
        ]);

      if (casesRes.error) throw casesRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (recentCasesRes.error) throw recentCasesRes.error;
      if (principalsRes.error) throw principalsRes.error;

      const cases = casesRes.data ?? [];
      const activities = activitiesRes.data ?? [];
      const invoices = invoicesRes.data ?? [];
      const toInvoiceActivities = activities.filter(
        (activity) => activity.status === "to_invoice" && !activity.invoice_id,
      );
      const activeCases = cases.filter((c) => c.status !== "closed" && c.status !== "archived");
      const caseIdsWithActivities = new Set(activities.map((activity) => activity.case_id));
      const casesWithoutActivities = activeCases.filter((c) => !caseIdsWithActivities.has(c.id));
      const casesToComplete = activeCases.filter(
        (c) =>
          caseIdsWithActivities.has(c.id) &&
          (!c.principal_id || !c.client_id || !c.counterparty_id),
      );
      const toInvoiceAmount = toInvoiceActivities.reduce(
        (sum, activity) => sum + Number(activity.amount ?? 0),
        0,
      );
      const expenseWithoutAttachment = toInvoiceActivities.filter(
        (activity) =>
          activity.kind === "expense_reimbursement" &&
          (activity.activity_attachments ?? []).length === 0,
      );
      const draftInvoices = invoices.filter((invoice) => invoice.status === "draft");
      const invoicesToCollect = invoices.filter(
        (invoice) => invoice.status === "issued" || invoice.status === "overdue",
      );
      const today = localDateKey(new Date());
      const overdueInvoices = invoices.filter(
        (invoice) =>
          invoice.status === "overdue" ||
          (invoice.status === "issued" && invoice.due_date && invoice.due_date < today),
      );
      const invoicesToCollectAmount = invoicesToCollect.reduce(
        (sum, invoice) => sum + Number(invoice.net_to_pay ?? 0),
        0,
      );
      const principalNames = new Map(
        (principalsRes.data ?? []).map((principal) => [principal.id, principal.business_name]),
      );
      const principalSummaries = Array.from(
        toInvoiceActivities
          .reduce((map, activity) => {
            const current = map.get(activity.principal_id) ?? {
              principalId: activity.principal_id,
              name: principalNames.get(activity.principal_id) ?? "Committente non disponibile",
              amount: 0,
              count: 0,
            };
            current.amount += Number(activity.amount ?? 0);
            current.count += 1;
            map.set(activity.principal_id, current);
            return map;
          }, new Map<string, { principalId: string; name: string; amount: number; count: number }>())
          .values(),
      )
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);

      return {
        casesWithoutActivities: casesWithoutActivities.length,
        casesToComplete: casesToComplete.length,
        toInvoiceCount: toInvoiceActivities.length,
        toInvoiceAmount,
        draftInvoiceCount: draftInvoices.length,
        invoicesToCollectAmount,
        overdueInvoiceCount: overdueInvoices.length,
        expenseWithoutAttachmentCount: expenseWithoutAttachment.length,
        principalSummaries,
        recentCases: recentCasesRes.data ?? [],
        workQueue: buildDashboardWorkQueue({
          cases: cases as DashboardCaseRow[],
          activities: activities as DashboardActivityRow[],
          invoices: invoices as DashboardInvoiceRow[],
        }),
      };
    },
  });

  const { data: duplicateSummary, isLoading: isDuplicateSummaryLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["dashboard-duplicate-summary", userId],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DuplicateSummary> =>
      readServerResult<DuplicateSummary>(
        await getDuplicateSummary({
          headers: await getAuthHeaders(),
        }),
      ),
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Pratiche, attività, fatture e rimborsi da tenere sotto controllo."
        actions={<CreateMenu />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Briefcase}
          label="Pratiche senza attività"
          value={isLoading ? "—" : String(data?.casesWithoutActivities ?? 0)}
          to="/pratiche"
          search={{ view: "without_activities" }}
        />
        <StatCard
          icon={AlertTriangle}
          label="Pratiche da completare"
          value={isLoading ? "—" : String(data?.casesToComplete ?? 0)}
          tone={data && data.casesToComplete > 0 ? "danger" : "default"}
          to="/pratiche"
          search={{ view: "to_complete" }}
        />
        <StatCard
          icon={ListChecks}
          label="Attività da fatturare"
          value={isLoading ? "—" : String(data?.toInvoiceCount ?? 0)}
          to="/attivita"
          search={{ status: "to_invoice" }}
        />
        <StatCard
          icon={Receipt}
          label="Maturato da fatturare"
          value={isLoading ? "—" : formatCurrency(data?.toInvoiceAmount ?? 0)}
          tone="gold"
          to="/attivita"
          search={{ status: "to_invoice", sort: "amount", dir: "desc" }}
        />
        <StatCard
          icon={Receipt}
          label="Fatture in bozza"
          value={isLoading ? "—" : String(data?.draftInvoiceCount ?? 0)}
          to="/fatture"
          search={{ status: "draft" }}
        />
        <StatCard
          icon={Receipt}
          label="Fatture da incassare"
          value={isLoading ? "—" : formatCurrency(data?.invoicesToCollectAmount ?? 0)}
          tone="gold"
          to="/fatture"
          search={{ status: "to_collect" }}
        />
        <StatCard
          icon={AlertTriangle}
          label="Fatture scadute"
          value={isLoading ? "—" : String(data?.overdueInvoiceCount ?? 0)}
          tone={data && data.overdueInvoiceCount > 0 ? "danger" : "default"}
          to="/fatture"
          search={{ status: "expired" }}
        />
        <StatCard
          icon={FileWarning}
          label="Rimborsi senza allegato"
          value={isLoading ? "—" : String(data?.expenseWithoutAttachmentCount ?? 0)}
          tone={data && data.expenseWithoutAttachmentCount > 0 ? "danger" : "default"}
          to="/attivita"
          search={{ status: "to_invoice", kind: "expense_reimbursement", attachments: "missing" }}
        />
      </div>

      <WorkQueueCard items={data?.workQueue ?? []} isLoading={isLoading} />

      <DuplicateSummaryBox summary={duplicateSummary} isLoading={isDuplicateSummaryLoading} />

      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Pratiche recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentCases.length ? (
              <ul className="divide-y">
                {data.recentCases.map((c) => (
                  <li key={c.id} className="py-2.5">
                    <Link
                      to="/pratiche/$caseId"
                      params={{ caseId: routeRef(c) }}
                      className="flex min-w-0 items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{practiceDisplayName(c)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.principal?.business_name ?? "—"} ·{" "}
                          {c.client ? clientDisplayName(c.client as ClientDisplayData) : "—"} ·{" "}
                          {c.counterparty
                            ? counterpartyDisplayName(c.counterparty as CounterpartyDisplayData)
                            : "—"}
                        </p>
                      </div>
                      <Badge
                        variant={caseStatusVariant[c.status] ?? "outline"}
                        className="shrink-0"
                      >
                        {caseStatusLabels[c.status] ?? c.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <TableEmptyState
                icon={<Briefcase className="size-5" strokeWidth={1.6} />}
                title="Nessuna pratica recente"
                description="Crea la prima pratica per vedere qui le attività più recenti."
                action={
                  <Button size="sm" asChild>
                    <Link to="/pratiche/nuova">Nuova pratica</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Committenti da fatturare</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.principalSummaries.length ? (
              <ul className="divide-y">
                {data.principalSummaries.map((principal) => (
                  <li key={principal.principalId} className="py-2.5">
                    <Link
                      to="/fatture/nuova"
                      className="flex min-w-0 items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{principal.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {principal.count} {principal.count === 1 ? "attività" : "attività"} da
                          fatturare
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCurrency(principal.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <TableEmptyState
                icon={<Receipt className="size-5" strokeWidth={1.6} />}
                title="Nessuna attività da fatturare"
                description="Registra compensi o rimborsi spese per prepararli alla fattura."
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/attivita">Vai ad Attività</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function buildDashboardWorkQueue({
  cases,
  activities,
  invoices,
}: {
  cases: DashboardCaseRow[];
  activities: DashboardActivityRow[];
  invoices: DashboardInvoiceRow[];
}) {
  const activitiesByCase = activities.reduce<Record<string, DashboardActivityRow[]>>(
    (acc, activity) => {
      const current = acc[activity.case_id] ?? [];
      current.push(activity);
      acc[activity.case_id] = current;
      return acc;
    },
    {},
  );
  const invoicesByCase = invoices.reduce<Record<string, DashboardInvoiceRow[]>>((acc, invoice) => {
    if (!invoice.case_id) return acc;
    const current = acc[invoice.case_id] ?? [];
    current.push(invoice);
    acc[invoice.case_id] = current;
    return acc;
  }, {});

  return cases
    .filter((caseRow) => caseRow.status !== "closed" && caseRow.status !== "archived")
    .map((caseRow) => {
      const caseActivities = activitiesByCase[caseRow.id] ?? [];
      const caseInvoices = invoicesByCase[caseRow.id] ?? [];
      const totals = summarizeCaseOperations(caseActivities, caseInvoices);
      const qualityChecks = buildCaseWorkflowQualityChecks({
        caseRow,
        activities: caseActivities,
        invoices: caseInvoices,
        totals,
      });
      const workflow = buildDebtCollectionWorkflow({
        caseRow,
        activities: caseActivities,
        invoices: caseInvoices,
        totals,
        qualityChecks,
      });

      return {
        caseRef: routeRef(caseRow),
        practiceNumber: caseRow.practice_number,
        updatedAt: caseRow.updated_at,
        stage: workflow.stage,
        action: workflow.action,
        reason: workflow.reason,
        priorityLabel: formatCaseWorkflowPriorityLabel(workflow.priority),
        priorityVariant: workflow.priorityVariant,
      } satisfies WorkQueueItem;
    })
    .filter((item) => item.stage !== "Pratica sotto controllo")
    .sort((a, b) => {
      const priorityDiff = priorityRank(a.priorityVariant) - priorityRank(b.priorityVariant);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 5);
}

function priorityRank(variant: CaseDebtCollectionWorkflow["priorityVariant"]) {
  if (variant === "destructive") return 0;
  if (variant === "outline") return 1;
  return 2;
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
