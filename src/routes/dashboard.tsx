import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronDown,
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
          supabase.from("cases").select("id, status, principal_id, client_id, counterparty_id"),
          supabase
            .from("case_activities")
            .select("id, case_id, kind, amount, principal_id, status"),
          supabase.from("invoices").select("id, status, due_date, net_to_pay"),
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
      const expenseActivityIds = toInvoiceActivities
        .filter((activity) => activity.kind === "expense_reimbursement")
        .map((activity) => activity.id);
      const attachmentsRes =
        expenseActivityIds.length > 0
          ? await supabase
              .from("activity_attachments")
              .select("activity_id")
              .in("activity_id", expenseActivityIds)
          : { data: [], error: null };
      if (attachmentsRes.error) throw attachmentsRes.error;

      const attachedActivityIds = new Set(
        (attachmentsRes.data ?? []).map((item) => item.activity_id),
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
          activity.kind === "expense_reimbursement" && !attachedActivityIds.has(activity.id),
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
        />
        <StatCard
          icon={AlertTriangle}
          label="Pratiche da completare"
          value={isLoading ? "—" : String(data?.casesToComplete ?? 0)}
          tone={data && data.casesToComplete > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={ListChecks}
          label="Attività da fatturare"
          value={isLoading ? "—" : String(data?.toInvoiceCount ?? 0)}
        />
        <StatCard
          icon={Receipt}
          label="Maturato da fatturare"
          value={isLoading ? "—" : formatCurrency(data?.toInvoiceAmount ?? 0)}
          tone="gold"
        />
        <StatCard
          icon={Receipt}
          label="Fatture in bozza"
          value={isLoading ? "—" : String(data?.draftInvoiceCount ?? 0)}
        />
        <StatCard
          icon={Receipt}
          label="Fatture da incassare"
          value={isLoading ? "—" : formatCurrency(data?.invoicesToCollectAmount ?? 0)}
          tone="gold"
        />
        <StatCard
          icon={AlertTriangle}
          label="Fatture scadute"
          value={isLoading ? "—" : String(data?.overdueInvoiceCount ?? 0)}
          tone={data && data.overdueInvoiceCount > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={FileWarning}
          label="Rimborsi senza allegato"
          value={isLoading ? "—" : String(data?.expenseWithoutAttachmentCount ?? 0)}
          tone={data && data.expenseWithoutAttachmentCount > 0 ? "danger" : "default"}
        />
      </div>

      <Card className="mt-4 border-border/70 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Prossime azioni operative</CardTitle>
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
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone?: "default" | "danger" | "gold";
}) {
  const iconCls =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "gold"
        ? "bg-brand-gold/10 text-brand-gold"
        : "bg-primary/5 text-primary";
  const valueCls = tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <Card className="border-border/70 shadow-soft">
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
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
