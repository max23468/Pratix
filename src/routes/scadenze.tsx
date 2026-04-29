import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { DeadlineDialog } from "@/components/deadline-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/scadenze")({
  head: () => ({
    meta: [
      { title: "Scadenzario — Pratix" },
      { name: "description", content: "Tutte le scadenze delle tue pratiche in un unico posto." },
    ],
  }),
  component: () => (
    <AppLayout>
      <ScadenzeContent />
    </AppLayout>
  ),
});

type Filter = "all" | "open" | "overdue" | "week" | "completed";

function ScadenzeContent() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");

  const { data, isLoading } = useQuery({
    queryKey: ["deadlines-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_deadlines")
        .select("id, due_date, description, completed, completed_at, case_id, cases(id, case_number, title)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const inWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const filtered = useMemo(() => {
    const items = data ?? [];
    switch (filter) {
      case "open":
        return items.filter((d) => !d.completed);
      case "overdue":
        return items.filter((d) => !d.completed && d.due_date < today);
      case "week":
        return items.filter((d) => !d.completed && d.due_date >= today && d.due_date <= inWeek);
      case "completed":
        return items.filter((d) => d.completed);
      default:
        return items;
    }
  }, [data, filter, today, inWeek]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const d of filtered) {
      const arr = map.get(d.due_date) ?? [];
      arr.push(d);
      map.set(d.due_date, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deadlines-global"] });
      qc.invalidateQueries({ queryKey: ["case-deadlines"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("case_deadlines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scadenza eliminata");
      qc.invalidateQueries({ queryKey: ["deadlines-global"] });
      qc.invalidateQueries({ queryKey: ["case-deadlines"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Scadenzario"
        description="Tutte le scadenze delle tue pratiche."
        actions={<DeadlineDialog allowCasePicker />}
      />

      <div className="mb-4 flex items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Da fare</SelectItem>
            <SelectItem value="overdue">Scadute</SelectItem>
            <SelectItem value="week">Prossimi 7 giorni</SelectItem>
            <SelectItem value="completed">Completate</SelectItem>
            <SelectItem value="all">Tutte</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "scadenza" : "scadenze"}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nessuna scadenza per i filtri selezionati.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => {
            const overdue = !items[0].completed && date < today;
            return (
              <Card key={date}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b px-4 py-2.5">
                    <p className="text-sm font-semibold">{formatDate(date)}</p>
                    {overdue && <Badge variant="destructive">Scaduta</Badge>}
                  </div>
                  <ul className="divide-y">
                    {items.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                        <Button
                          size="icon"
                          variant={d.completed ? "default" : "outline"}
                          className="h-7 w-7 shrink-0"
                          onClick={() => toggle.mutate({ id: d.id, completed: d.completed })}
                          aria-label={d.completed ? "Riapri" : "Completa"}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm font-medium ${
                              d.completed ? "text-muted-foreground line-through" : ""
                            }`}
                          >
                            {d.description}
                          </p>
                          {d.cases && (
                            <Link
                              to="/pratiche/$caseId"
                              params={{ caseId: d.cases.id }}
                              className="truncate text-xs text-muted-foreground hover:text-primary hover:underline"
                            >
                              {d.cases.case_number} · {d.cases.title}
                            </Link>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (confirm("Eliminare questa scadenza?")) remove.mutate(d.id);
                          }}
                          aria-label="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
