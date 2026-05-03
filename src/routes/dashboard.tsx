import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Receipt, Wallet, Plus, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import { caseStatusLabels, caseStatusVariant, clientDisplayName } from "@/lib/labels";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Pratix" },
      { name: "description", content: "Una visione d'insieme della tua professione." },
      { property: "og:title", content: "Dashboard · Pratix" },
      { property: "og:description", content: "Una visione d'insieme della tua professione." },
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
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);

      const [casesRes, invoicesRes, recentCasesRes, clientsRes] = await Promise.all([
        supabase
          .from("cases")
          .select("id, status", { count: "exact" })
          .in("status", ["open", "in_progress"]),
        supabase
          .from("invoices")
          .select(
            "id, status, total_amount, net_to_pay, issue_date, due_date, paid_at, number, year",
          ),
        supabase
          .from("cases")
          .select(
            "id, case_number, title, status, updated_at, client_id, clients(kind, first_name, last_name, business_name)",
          )
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase.from("clients").select("id", { count: "exact", head: true }),
      ]);

      if (casesRes.error) throw casesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (recentCasesRes.error) throw recentCasesRes.error;
      if (clientsRes.error) throw clientsRes.error;

      const activeCases = casesRes.count ?? casesRes.data?.length ?? 0;
      const totalClients = clientsRes.count ?? 0;
      const invoices = invoicesRes.data ?? [];
      const unpaid = invoices
        .filter((i) => i.status === "issued" || i.status === "overdue")
        .reduce((sum, i) => sum + Number(i.net_to_pay ?? 0), 0);
      const overdue = invoices.filter(
        (i) =>
          (i.status === "issued" || i.status === "overdue") && i.due_date && i.due_date < today,
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
        totalClients,
        unpaid,
        overdueCount: overdue.length,
        overdueTotal,
        draftCount: drafts.length,
        draftTotal,
        collectedMonth,
        revenueYear,
        recentCases: recentCasesRes.data ?? [],
      };
    },
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Una visione d'insieme della tua professione."
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
        <StatCard
          icon={Briefcase}
          label="Pratiche attive"
          value={isLoading ? "—" : String(data?.activeCases ?? 0)}
        />
        <StatCard
          icon={Users}
          label="Clienti"
          value={isLoading ? "—" : String(data?.totalClients ?? 0)}
        />
        <StatCard
          icon={Wallet}
          label="Bozze"
          value={
            isLoading ? "—" : `${data?.draftCount ?? 0} · ${formatCurrency(data?.draftTotal ?? 0)}`
          }
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
          icon={TrendingUp}
          label="Incassato (mese)"
          value={isLoading ? "—" : formatCurrency(data?.collectedMonth ?? 0)}
          tone="gold"
        />
        <StatCard
          icon={TrendingUp}
          label={`Fatturato ${new Date().getFullYear()}`}
          value={isLoading ? "—" : formatCurrency(data?.revenueYear ?? 0)}
          tone="gold"
        />
      </div>

      <div className="mt-6">
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
                          {c.case_number} ·{c.clients ? clientDisplayName(c.clients) : "—"}
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
                Nessuna pratica ancora.{" "}
                <Link to="/pratiche/nuova" className="text-primary hover:underline">
                  Crea la prima
                </Link>
                .
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
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconCls}`}
        >
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
