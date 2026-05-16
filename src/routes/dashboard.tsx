import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronDown,
  FileWarning,
  FileUp,
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

type CreateActionPath =
  | "/pratiche/nuova"
  | "/committenti/nuovo"
  | "/clienti/nuovo"
  | "/controparti/nuova"
  | "/fatture/nuova"
  | "/prezzi/nuovo"
  | "/import-archivio";

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
    to: "/import-archivio",
    icon: FileUp,
    title: "Import archivio",
    description: "Importa o trascrivi nuove pratiche",
  },
];

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Pratix" },
      {
        name: "description",
        content: "Pratiche, attività da fatturare e committenti da tenere sotto controllo.",
      },
      { property: "og:title", content: "Dashboard · Pratix" },
      {
        property: "og:description",
        content: "Pratiche, attività da fatturare e committenti da tenere sotto controllo.",
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

  const { data, isLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["dashboard", userId],
    queryFn: async () => {
      const [casesRes, activitiesRes, recentCasesRes, principalsRes] = await Promise.all([
        supabase.from("cases").select("id, status"),
        supabase
          .from("case_activities")
          .select("id, kind, amount, principal_id")
          .eq("status", "to_invoice"),
        supabase
          .from("cases")
          .select(
            "id, case_number, practice_number, title, status, updated_at, principal:principals(business_name), client:clients(kind, first_name, last_name, business_name), counterparty:counterparties(kind, first_name, last_name, business_name)",
          )
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase.from("principals").select("id, business_name"),
      ]);

      if (casesRes.error) throw casesRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (recentCasesRes.error) throw recentCasesRes.error;
      if (principalsRes.error) throw principalsRes.error;

      const cases = casesRes.data ?? [];
      const activities = activitiesRes.data ?? [];
      const expenseActivityIds = activities
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
      const openCases = cases.filter((c) => c.status === "open" || c.status === "in_progress");
      const suspendedCases = cases.filter((c) => c.status === "suspended");
      const closedCases = cases.filter((c) => c.status === "closed");
      const archivedCases = cases.filter((c) => c.status === "archived");
      const toInvoiceAmount = activities.reduce(
        (sum, activity) => sum + Number(activity.amount ?? 0),
        0,
      );
      const expenseWithoutAttachment = activities.filter(
        (activity) =>
          activity.kind === "expense_reimbursement" && !attachedActivityIds.has(activity.id),
      );
      const principalNames = new Map(
        (principalsRes.data ?? []).map((principal) => [principal.id, principal.business_name]),
      );
      const principalSummaries = Array.from(
        activities
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
        openCases: openCases.length,
        suspendedCases: suspendedCases.length,
        closedCases: closedCases.length,
        archivedCases: archivedCases.length,
        toInvoiceCount: activities.length,
        toInvoiceAmount,
        expenseWithoutAttachmentCount: expenseWithoutAttachment.length,
        principalSummaries,
        recentCases: recentCasesRes.data ?? [],
      };
    },
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Pratiche, attività da fatturare e committenti da tenere sotto controllo."
        actions={
          <>
            <Link to="/prezzi">
              <Button size="sm" variant="outline">
                <Tags className="mr-1 size-4" /> Prezzi
              </Button>
            </Link>
            <Link to="/fatture/nuova">
              <Button size="sm" variant="outline">
                <Receipt className="mr-1 size-4" /> Fattura
              </Button>
            </Link>
            <Link to="/attivita">
              <Button size="sm" variant="outline">
                <ListChecks className="mr-1 size-4" /> Attività
              </Button>
            </Link>
            <CreateMenu />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Briefcase}
          label="Pratiche aperte"
          value={isLoading ? "—" : String(data?.openCases ?? 0)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Pratiche sospese"
          value={isLoading ? "—" : String(data?.suspendedCases ?? 0)}
          tone={data && data.suspendedCases > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={Briefcase}
          label="Chiuse / archiviate"
          value={isLoading ? "—" : `${data?.closedCases ?? 0} / ${data?.archivedCases ?? 0}`}
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
            to="/import-archivio"
            icon={FileUp}
            title="Importa archivio"
            description="Trascrivi o importa nuove pratiche"
          />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card>
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
                      params={{ caseId: c.id }}
                      className="flex items-center justify-between gap-2"
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
                      <Badge variant={caseStatusVariant[c.status] ?? "outline"}>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Committenti da fatturare</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.principalSummaries.length ? (
              <ul className="divide-y">
                {data.principalSummaries.map((principal) => (
                  <li key={principal.principalId} className="py-2.5">
                    <Link to="/fatture/nuova" className="flex items-center justify-between gap-3">
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
  to: "/attivita" | "/fatture/nuova" | "/import-archivio";
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
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
          <Icon className="size-5" strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={`font-display tabular truncate text-xl font-semibold tracking-tight ${valueCls}`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
