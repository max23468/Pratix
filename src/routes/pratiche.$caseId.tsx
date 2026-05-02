import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CaseForm } from "@/components/case-form";
import { DeadlineDialog } from "@/components/deadline-form";
import { ExpenseDialog } from "@/components/expense-form";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseStatusLabels,
  caseStatusVariant,
  expenseCategoryLabels,
  clientDisplayName,
} from "@/lib/labels";

export const Route = createFileRoute("/pratiche/$caseId")({
  head: () => ({
    meta: [
      { title: "Pratica · Pratix" },
      { name: "description", content: "Dettaglio pratica con scadenze e spese." },
      { property: "og:title", content: "Pratica · Pratix" },
      { property: "og:description", content: "Dettaglio pratica con scadenze e spese." },
    ],
  }),
  component: () => (
    <AppLayout>
      <CaseDetail />
    </AppLayout>
  ),
});

function CaseDetail() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, clients(kind, first_name, last_name, business_name)")
        .eq("id", caseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }
  if (!caseRow) {
    return (
      <>
        <PageHeader title="Pratica non trovata" />
        <Link to="/pratiche">
          <Button size="sm" variant="outline">
            <ArrowLeft className="mr-1 h-4 w-4" /> Torna alle pratiche
          </Button>
        </Link>
      </>
    );
  }

  const clientName = caseRow.clients ? clientDisplayName(caseRow.clients) : "—";

  return (
    <>
      <PageHeader
        title={caseRow.title}
        description={`${caseRow.case_number} · ${clientName}`}
        actions={
          <>
            <Badge variant={caseStatusVariant[caseRow.status] ?? "outline"}>
              {caseStatusLabels[caseRow.status] ?? caseRow.status}
            </Badge>
            <Link to="/pratiche">
              <Button size="sm" variant="outline">
                <ArrowLeft className="mr-1 h-4 w-4" /> Indietro
              </Button>
            </Link>
          </>
        }
      />

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Dati</TabsTrigger>
          <TabsTrigger value="deadlines">Scadenze</TabsTrigger>
          <TabsTrigger value="expenses">Spese</TabsTrigger>
          <TabsTrigger value="history">Storico stati</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <CaseForm
            initial={caseRow}
            onSaved={() => navigate({ to: "/pratiche" })}
            onCancel={() => navigate({ to: "/pratiche" })}
          />
        </TabsContent>

        <TabsContent value="deadlines" className="mt-4">
          <DeadlinesTab caseId={caseId} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab caseId={caseId} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab caseId={caseId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function DeadlinesTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["case-deadlines", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_deadlines")
        .select("*")
        .eq("case_id", caseId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async (d: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("case_deadlines")
        .update({
          completed: !d.completed,
          completed_at: !d.completed ? new Date().toISOString() : null,
        })
        .eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-deadlines", caseId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("case_deadlines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scadenza eliminata");
      qc.invalidateQueries({ queryKey: ["case-deadlines", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Scadenze</CardTitle>
        <DeadlineDialog caseId={caseId} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : data && data.length > 0 ? (
          <ul className="divide-y">
            {data.map((d) => {
              const overdue = !d.completed && d.due_date < today;
              return (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      size="icon"
                      variant={d.completed ? "default" : "outline"}
                      className="h-7 w-7"
                      onClick={() => toggle.mutate({ id: d.id, completed: d.completed })}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${d.completed ? "line-through text-muted-foreground" : "font-medium"}`}>
                        {d.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={overdue ? "destructive" : "outline"}>
                      {formatDate(d.due_date)}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => remove.mutate(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna scadenza registrata.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ExpensesTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["case-expenses", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("case_id", caseId)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spesa eliminata");
      qc.invalidateQueries({ queryKey: ["case-expenses", caseId] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = (data ?? []).reduce(
    (acc, e) => {
      const amt = Number(e.amount) || 0;
      if (e.is_art15) acc.art15 += amt;
      else acc.taxable += amt;
      return acc;
    },
    { taxable: 0, art15: 0 },
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Spese</CardTitle>
        <ExpenseDialog caseId={caseId} />
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Imponibili</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.taxable)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Anticipazioni Art. 15</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.art15)}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : data && data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{formatDate(e.expense_date)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {expenseCategoryLabels[e.category] ?? e.category}
                  </TableCell>
                  <TableCell className="text-sm">{e.description}</TableCell>
                  <TableCell>
                    <Badge variant={e.is_art15 ? "secondary" : "outline"}>
                      {e.is_art15 ? "Art. 15" : "Imponibile"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(Number(e.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => remove.mutate(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna spesa registrata.</p>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryTab({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["case-history", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_status_history")
        .select("*")
        .eq("case_id", caseId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Storico stati</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : data && data.length > 0 ? (
          <ul className="space-y-3">
            {data.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {h.previous_status && (
                    <>
                      <Badge variant="outline">
                        {caseStatusLabels[h.previous_status] ?? h.previous_status}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                    </>
                  )}
                  <Badge variant={caseStatusVariant[h.new_status] ?? "outline"}>
                    {caseStatusLabels[h.new_status] ?? h.new_status}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(h.changed_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nessun cambio di stato registrato.</p>
        )}
      </CardContent>
    </Card>
  );
}
