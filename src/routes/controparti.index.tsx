import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TableEmptyState } from "@/components/table-empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  compareCounterparties,
  counterpartyDisplayName,
  counterpartyKindLabels,
} from "@/lib/labels";

export const Route = createFileRoute("/controparti/")({
  head: () => ({
    meta: [
      { title: "Controparti · Pratix" },
      {
        name: "description",
        content: "Gestisci società, persone e controparti composte.",
      },
      { property: "og:title", content: "Controparti · Pratix" },
      {
        property: "og:description",
        content: "Gestisci società, persone e controparti composte.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <ContropartiList />
    </AppLayout>
  ),
});

function ContropartiList() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");

  const { data: counterparties, isLoading } = useQuery({
    queryKey: ["counterparties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, kind, first_name, last_name, business_name, notes, updated_at");
      if (error) throw error;
      return (data ?? []).slice().sort(compareCounterparties);
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["counterparty-subjects", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparty_subjects")
        .select("counterparty_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const subjectCounts = useMemo(() => {
    return subjects.reduce<Record<string, number>>((acc, subject) => {
      acc[subject.counterparty_id] = (acc[subject.counterparty_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [subjects]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!counterparties) return [];
    return counterparties.filter((counterparty) => {
      if (kind !== "all" && counterparty.kind !== kind) return false;
      if (!term) return true;
      const name = counterpartyDisplayName(counterparty).toLowerCase();
      return name.includes(term) || (counterparty.notes ?? "").toLowerCase().includes(term);
    });
  }, [counterparties, kind, q]);

  return (
    <>
      <PageHeader
        title="Controparti"
        description="Anagrafica di debitori, società e gruppi di soggetti."
        actions={
          <Link to="/controparti/nuova">
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Nuova controparte
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, ragione sociale o note…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger aria-label="Filtra controparti per tipo" className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {Object.entries(counterpartyKindLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Soggetti</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  <TableEmptyState
                    title={
                      q || kind !== "all" ? "Nessuna controparte trovata" : "Nessuna controparte"
                    }
                    description={
                      q || kind !== "all"
                        ? "Modifica ricerca o filtro per ampliare i risultati."
                        : "Aggiungi la prima controparte per collegarla alle pratiche."
                    }
                    action={
                      !q && kind === "all" ? (
                        <Button size="sm" asChild>
                          <Link to="/controparti/nuova">Nuova controparte</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((counterparty) => (
                <TableRow key={counterparty.id} className="relative cursor-pointer">
                  <TableCell>
                    <Link
                      to="/controparti/$counterpartyId"
                      params={{ counterpartyId: counterparty.id }}
                      className="font-medium after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {counterpartyDisplayName(counterparty)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {counterpartyKindLabels[counterparty.kind] ?? counterparty.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {counterparty.kind === "group" ? (subjectCounts[counterparty.id] ?? 0) : "—"}
                  </TableCell>
                  <TableCell className="max-w-sm truncate text-sm text-muted-foreground">
                    {counterparty.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
