import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableEmptyState } from "@/components/table-empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/pratiche/")({
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
  const [q, setQ] = useState("");
  const [view, setView] = useState<string>("open");
  const [sort, setSort] = useState<string>("updated_desc");

  const { data, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, case_number, practice_number, title, status, opened_at, updated_at, client_id, principal_id, counterparty_id, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["case-activity-statuses", "case-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activities")
        .select("case_id, status, amount");
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    const result = data.filter((c) => {
      const summary = activitySummaryByCase[c.id] ?? {
        toInvoice: 0,
        invoiced: 0,
        toInvoiceAmount: 0,
      };
      if (view === "open" && c.status !== "open" && c.status !== "in_progress") return false;
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

    return result.toSorted((a, b) => {
      const aSummary = activitySummaryByCase[a.id]?.toInvoiceAmount ?? 0;
      const bSummary = activitySummaryByCase[b.id]?.toInvoiceAmount ?? 0;
      if (sort === "practice_asc") return a.practice_number - b.practice_number;
      if (sort === "practice_desc") return b.practice_number - a.practice_number;
      if (sort === "to_invoice_desc") return bSummary - aSummary;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [activitySummaryByCase, data, q, sort, view]);

  return (
    <>
      <PageHeader
        title="Pratiche"
        description="Tutte le tue pratiche in un unico posto."
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
        <Select value={view} onValueChange={setView}>
          <SelectTrigger aria-label="Filtra pratiche per vista" className="lg:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le pratiche</SelectItem>
            <SelectItem value="open">Aperte e in corso</SelectItem>
            <SelectItem value="to_invoice">Con attività da fatturare</SelectItem>
            <SelectItem value="invoiced">Con attività fatturate</SelectItem>
            <SelectItem value="suspended">Sospese</SelectItem>
            <SelectItem value="closed">Chiuse</SelectItem>
            <SelectItem value="archived">Archiviate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger aria-label="Ordina pratiche" className="lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Aggiornate di recente</SelectItem>
            <SelectItem value="practice_desc">Numero pratica decrescente</SelectItem>
            <SelectItem value="practice_asc">Numero pratica crescente</SelectItem>
            <SelectItem value="to_invoice_desc">Da fatturare</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numero</TableHead>
              <TableHead>Pratica</TableHead>
              <TableHead>Committente</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Controparte</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Fatturazione</TableHead>
              <TableHead>Aperta il</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  <TableEmptyState
                    title={
                      q || view !== "open" ? "Nessuna pratica trovata" : "Nessuna pratica aperta"
                    }
                    description={
                      q || view !== "open"
                        ? "Modifica ricerca, vista o ordinamento per ampliare i risultati."
                        : "Crea la prima pratica collegando committente, cliente e controparte."
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
              filtered.map((c) => {
                const summary = activitySummaryByCase[c.id] ?? {
                  toInvoice: 0,
                  invoiced: 0,
                  toInvoiceAmount: 0,
                };
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.practice_number}</TableCell>
                    <TableCell>
                      <Link
                        to="/pratiche/$caseId"
                        params={{ caseId: c.id }}
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
