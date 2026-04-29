import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Receipt, Wallet, AlertCircle, Plus, TrendingUp, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { caseStatusLabels, caseStatusVariant, clientDisplayName } from "@/lib/labels";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Pratix" },
      { name: "description", content: "Una visione d'insieme del tuo studio." },
      { property: "og:title", content: "Dashboard — Pratix" },
      { property: "og:description", content: "Una visione d'insieme del tuo studio." },
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
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const in14 = new Date(now);
      in14.setDate(in14.getDate() + 14);
      const horizon = in14.toISOString().slice(0, 10);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);

      const [casesRes, deadlinesRes, invoicesRes, recentCasesRes] = await Promise.all([
        supabase
          .from("cases")
          .select("id, status", { count: "exact" })
          .in("status", ["open", "in_progress"]),
        supabase
          .from("case_deadlines")
          .select("id, due_date, description, completed, case_id, cases(title)")
          .eq("completed", false)
          .lte("due_date", horizon)
          .order("due_date", { ascending: true })
          .limit(8),
        supabase
          .from("invoices")
          .select("id, status, total_amount, net_to_pay, issue_date, due_date, paid_at, number, year"),
        supabase
          .from("cases")
          .select("id, case_number, title, status, updated_at, client_id, clients(kind, first_name, last_name, business_name)")
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);

      if (casesRes.error) throw casesRes.error;
      if (deadlinesRes.error) throw deadlinesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (recentCasesRes.error) throw recentCasesRes.error;

      const activeCases = casesRes.count ?? casesRes.data?.length ?? 0;
      const invoices = invoicesRes.data ?? [];
      const unpaid = invoices
        .filter((i) => i.status === "issued" || i.status === "overdue")
        .reduce((sum, i) => sum + Number(i.net_to_pay ?? 0), 0);
      const overdue = invoices.filter(
        (i) => (i.status === "issued" || i.status === "overdue") && i.due_date && i.due_date < today,
      );
      const overdueTotal = overdue.reduce((sum, i) => sum + Number(i.net_to_pay ?? 0), 0);
      const drafts = invoices.filter((i) => i.status === "draft");
      const draftTotal = drafts.reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0);
      const collectedMonth = invoices
        .filter((i) => i.status === "paid" && i.paid_at && i.paid_at >= monthStart)
        .reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0);
      const revenueYear = invoices
        .filter((i) => i.status !== "draft" && i.issue_date >= yearStart)
        .reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0);

      return {
        activeCases,
        deadlines: deadlinesRes.data ?? [],
        unpaid,
        overdueCount: overdue.length,
        overdueTotal,
        draftCount: drafts.length,
        draftTotal,
        collectedMonth,
        revenueYear,
        recentCases: recentCasesRes.data ?? [],
        today,
      };
    },
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Una visione d'insieme del tuo studio."
        actions={
          <>
            <Link to="/pratiche/nuova">
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-4 w-4" /> Pratica
              </Button>
            </Link>
            <Link to="/clienti/nuovo">
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-4 w-4" /> Cliente
              </Button>
            </Link>
            <Link to="/fatture/nuova">
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Fattura
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Briefcase} label="Pratiche attive" value={isLoading ? "—" : String(data?.activeCases ?? 0)} />
        <StatCard
          icon={AlertCircle}
          label="Scadenze (14gg)"
          value={isLoading ? "—" : String(data?.deadlines.length ?? 0)}
        />
        <StatCard
          icon={Receipt}
          label="Da incassare"
          value={isLoading ? "—" : formatCurrency(data?.unpaid ?? 0)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Fatture scadute"
          value={
            isLoading
              ? "—"
              : `${data?.overdueCount ?? 0} · ${formatCurrency(data?.overdueTotal ?? 0)}`
          }
          tone={data && data.overdueCount > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={Wallet}
          label="Bozze"
          value={isLoading ? "—" : `${data?.draftCount ?? 0} · ${formatCurrency(data?.draftTotal ?? 0)}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Incassato (mese)"
          value={isLoading ? "—" : formatCurrency(data?.collectedMonth ?? 0)}
        />
        <StatCard
          icon={TrendingUp}
          label={`Fatturato ${new Date().getFullYear()}`}
          value={isLoading ? "—" : formatCurrency(data?.revenueYear ?? 0)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prossime scadenze</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.deadlines.length ? (
              <ul className="divide-y">
                {data.deadlines.map((d) => {
                  const overdue = d.due_date < (data.today ?? "");
                  return (
                    <li key={d.id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.description}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          
                          {d.cases?.title ?? "—"}
                        </p>
                      </div>
                      <Badge variant={overdue ? "destructive" : "outline"}>
                        {formatDate(d.due_date)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna scadenza nei prossimi 14 giorni.</p>
            )}
          </CardContent>
        </Card>

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
                          {c.case_number} · 
                          {c.clients ? clientDisplayName(c.clients) : "—"}
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
              <p className="text-sm text-muted-foreground">
                Nessuna pratica ancora. <Link to="/pratiche/nuova" className="text-primary hover:underline">Crea la prima</Link>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
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
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
          <Icon className="h-5 w-5" strokeWidth={1.6} />
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
