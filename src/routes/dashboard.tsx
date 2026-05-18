import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronDown,
  Flag,
  FileInput,
  FileWarning,
  GitCompareArrows,
  ListChecks,
  Plus,
  Receipt,
  Tags,
  User,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableEmptyState } from "@/components/table-empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import {
  caseStatusLabels,
  caseStatusVariant,
  clientDisplayName,
  counterpartyDisplayName,
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
import { getDuplicateSummaryFn, type DuplicateSummaryResult } from "@/server/duplicates.functions";

type CreateActionPath =
  | "/pratiche/nuova"
  | "/committenti/nuovo"
  | "/clienti/nuovo"
  | "/controparti/nuova"
  | "/fatture/nuova"
  | "/prezzi/nuovo"
  | "/creazione-guidata";

const CREATE_ACTIONS: Array<{
  to: CreateActionPath;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
}> = [
  {
    to: "/pratiche/nuova",
    icon: Briefcase,
    title: "Nuova pratica",
    description: "Apri una nuova pratica operativa",
  },
  {
    to: "/committenti/nuovo",
    icon: Building2,
    title: "Nuovo committente",
    description: "Aggiungi chi affida l'incarico",
  },
  {
    to: "/clienti/nuovo",
    icon: User,
    title: "Nuovo cliente",
    description: "Registra una nuova anagrafica",
  },
  {
    to: "/controparti/nuova",
    icon: Users,
    title: "Nuova controparte",
    description: "Crea persona, società o gruppo",
  },
  {
    to: "/fatture/nuova",
    icon: Receipt,
    title: "Nuova fattura",
    description: "Prepara un documento da emettere",
  },
  {
    to: "/prezzi/nuovo",
    icon: Tags,
    title: "Nuovi prezzi",
    description: "Crea un set annuale per committente",
  },
  {
    to: "/creazione-guidata",
    icon: FileInput,
    title: "Creazione guidata",
    description: "Trascrivi una pratica passo per passo",
  },
];

type DuplicateSummary = DuplicateSummaryResult;

type DashboardCaseRow = {
  id: string;
  public_code: string | null;
  practice_number: number;
  case_number: string | null;
  title: string;
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
  amount: number | null;
  principal_id: string;
  status: "to_invoice" | "invoiced";
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

type WorkQueueItem = {
  caseRef: string;
  practiceNumber: number;
  title: string;
  updatedAt: string;
  stage: string;
  action: string;
  reason: string;
  priorityLabel: string;
  priorityVariant: CaseDebtCollectionWorkflow["priorityVariant"];
};

type DashboardStatCardProps = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone?: "default" | "danger" | "gold";
} & (
  | {
      to: "/pratiche";
      search?: { view?: "without_activities" | "to_complete" };
    }
  | {
      to: "/attivita";
      search?: {
        status?: "to_invoice";
        kind?: "expense_reimbursement";
        attachments?: "missing";
        sort?: "amount";
        dir?: "desc";
      };
    }
  | {
      to: "/fatture";
      search?: { status?: "draft" | "to_collect" | "expired" };
    }
);

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
              "id, public_code, practice_number, case_number, title, status, updated_at, principal_id, client_id, counterparty_id",
            ),
          supabase
            .from("case_activities")
            .select("id, case_id, kind, amount, principal_id, status, activity_attachments(id)"),
          supabase
            .from("invoices")
            .select(
              "id, case_id, number, year, issue_date, due_date, paid_at, status, total_amount, net_to_pay, notes",
            ),
          supabase
            .from("cases")
            .select(
              "id, public_code, case_number, practice_number, title, status, updated_at, principal:principals(business_name), client:clients(kind, first_name, last_name, business_name), counterparty:counterparties(kind, first_name, last_name, business_name)",
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
      const toInvoiceActivities = activities.filter((activity) => activity.status === "to_invoice");
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

  const duplicateSummary = useQuery({
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
        actions={
          <>
            <Link to="/creazione-guidata">
              <Button size="sm" variant="outline">
                <FileInput className="mr-1 size-4" /> Creazione guidata
              </Button>
            </Link>
            <CreateMenu />
          </>
        }
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

      <Card className="mt-4 border-border/70 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Azioni rapide</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <ActionLink
            to="/attivita"
            icon={ListChecks}
            title="Controlla attività"
            description={`${data?.toInvoiceCount ?? 0} ${data?.toInvoiceCount === 1 ? "attività" : "attività"} da fatturare`}
          />
          <ActionLink
            to="/fatture/nuova"
            icon={Receipt}
            title="Prepara fattura"
            description={`${formatCurrency(data?.toInvoiceAmount ?? 0)} maturati`}
          />
          <ActionLink
            to="/creazione-guidata"
            icon={FileInput}
            title="Creazione guidata"
            description="Trascrivi una pratica con controllo finale"
          />
        </CardContent>
      </Card>

      <DuplicateSummaryBox summary={duplicateSummary.data} isLoading={duplicateSummary.isLoading} />

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
                        <p className="truncate text-sm font-medium">{c.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.practice_number} · {c.principal?.business_name ?? "—"} ·{" "}
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

function WorkQueueCard({ items, isLoading }: { items: WorkQueueItem[]; isLoading: boolean }) {
  const [firstItem, ...otherItems] = items;

  return (
    <Card className="mt-4 border-border/70 shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Coda di lavoro</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calcolo delle priorità operative…</p>
        ) : firstItem ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <Link
              to="/pratiche/$caseId"
              params={{ caseId: firstItem.caseRef }}
              className="rounded-md border border-border p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={firstItem.priorityVariant}>{firstItem.priorityLabel}</Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  Pratica {firstItem.practiceNumber} · {firstItem.stage}
                </span>
              </div>
              <h2 className="mt-3 text-base font-semibold text-foreground">{firstItem.action}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{firstItem.reason}</p>
              <p className="mt-3 truncate text-sm font-medium text-foreground">{firstItem.title}</p>
            </Link>

            <div className="space-y-2">
              {otherItems.length > 0 ? (
                otherItems.slice(0, 3).map((item) => (
                  <Link
                    key={item.caseRef}
                    to="/pratiche/$caseId"
                    params={{ caseId: item.caseRef }}
                    className="flex min-w-0 gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Flag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          Pratica {item.practiceNumber}
                        </span>
                        <Badge variant={item.priorityVariant}>{item.priorityLabel}</Badge>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {item.action}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                  Questa è l'unica priorità operativa rilevata ora.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border p-4">
            <p className="text-sm font-medium">Nessuna pratica richiede intervento immediato.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Puoi continuare da Attività, Fatture o dalla Creazione guidata quando devi registrare
              nuovo lavoro.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DuplicateSummaryBox({
  summary,
  isLoading,
}: {
  summary?: DuplicateSummary;
  isLoading: boolean;
}) {
  if (!isLoading && !summary) {
    return null;
  }

  const openCount = summary?.openCount ?? 0;
  const highConfidenceCount = summary?.highConfidenceCount ?? 0;
  const hasOpen = openCount > 0;
  const badgeText = isLoading
    ? "Controllo…"
    : hasOpen
      ? `${openCount} da verificare`
      : "Dati in ordine";
  const description = hasOpen
    ? "Ci sono coppie da rivedere prima di creare nuovi dati operativi."
    : "Non risultano potenziali duplicati aperti.";

  return (
    <Card className="mt-4 border-border/70 shadow-soft">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
              hasOpen ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary"
            }`}
          >
            <GitCompareArrows className="size-5" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Controllo duplicati</h2>
              <Badge variant={hasOpen ? "destructive" : "secondary"}>{badgeText}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[30rem]">
          <DuplicateSummaryMetric
            label="Da verificare"
            value={isLoading ? "—" : String(openCount)}
            tone={hasOpen ? "danger" : "default"}
          />
          <DuplicateSummaryMetric
            label="Alta probabilità"
            value={isLoading ? "—" : String(highConfidenceCount)}
            tone={highConfidenceCount > 0 ? "danger" : "default"}
          />
          <DuplicateSummaryMetric
            label="Rimandati"
            value={isLoading ? "—" : String(summary?.snoozedCount ?? 0)}
          />
          <DuplicateSummaryMetric
            label="Risolti"
            value={isLoading ? "—" : String(summary?.resolvedCount ?? 0)}
          />
        </div>

        <Button variant={hasOpen ? "default" : "outline"} asChild className="shrink-0">
          <Link to="/controllo-duplicati">
            <GitCompareArrows className="mr-1 size-4" />
            Apri controllo
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function DuplicateSummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-md border border-border/70 p-3">
      <p className="text-[11px] leading-snug font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg leading-tight font-semibold tabular-nums ${
          tone === "danger" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" aria-label="Apri menu creazione">
          <Plus className="mr-1 size-4" />
          Crea
          <ChevronDown className="ml-1 size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Cosa vuoi creare?</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CREATE_ACTIONS.map((action) => (
          <DropdownMenuItem key={action.to} asChild>
            <Link to={action.to} className="items-start gap-3 py-2">
              <action.icon className="mt-0.5 size-4" strokeWidth={1.7} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{action.title}</span>
                <span className="block text-xs text-muted-foreground">{action.description}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: "/attivita" | "/fatture/nuova" | "/creazione-guidata";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
}) {
  return (
    <Button variant="outline" asChild className="h-auto justify-start p-3 text-left">
      <Link to={to} className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary">
          <Icon className="size-4" strokeWidth={1.7} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {description}
          </span>
        </span>
      </Link>
    </Button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  to,
  search,
}: DashboardStatCardProps) {
  const iconCls =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "gold"
        ? "bg-brand-gold/10 text-brand-gold"
        : "bg-primary/5 text-primary";
  const valueCls = tone === "danger" ? "text-destructive" : "text-foreground";

  const content = (
    <Card className="h-full border-border/70 shadow-soft transition-colors group-hover:bg-accent/40">
      <CardContent className="flex min-h-[7rem] flex-col items-start gap-2 p-3 sm:min-h-0 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 ${iconCls}`}
        >
          <Icon className="size-5" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 self-stretch sm:self-auto">
          <p className="text-[11px] leading-snug font-medium text-muted-foreground sm:text-xs">
            {label}
          </p>
          <p
            className={`font-display tabular text-lg leading-tight font-semibold tracking-tight break-words sm:text-xl ${valueCls}`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const className =
    "group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const ariaLabel = `Apri ${label.toLowerCase()}`;

  if (to === "/pratiche") {
    return (
      <Link to="/pratiche" search={search} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  if (to === "/attivita") {
    return (
      <Link to="/attivita" search={search} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Link to="/fatture" search={search} aria-label={ariaLabel} className={className}>
      {content}
    </Link>
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
        title: caseRow.title,
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
