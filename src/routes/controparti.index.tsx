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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { counterpartyDisplayName, counterpartyKindLabels } from "@/lib/labels";

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

  const { data: counterparties, isLoading } = useQuery({
    queryKey: ["counterparties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, kind, first_name, last_name, business_name, notes, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
    if (!term) return counterparties;
    return counterparties.filter((counterparty) => {
      const name = counterpartyDisplayName(counterparty).toLowerCase();
      return name.includes(term) || (counterparty.notes ?? "").toLowerCase().includes(term);
    });
  }, [counterparties, q]);

  return (
    <>
      <PageHeader
        title="Controparti"
        description="Anagrafica di debitori, società e gruppi di soggetti."
        actions={
          <Link to="/controparti/nuova">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nuova controparte
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, ragione sociale o note…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-9"
          />
        </div>
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
                  {q ? "Nessun risultato." : "Nessuna controparte. Aggiungi la prima."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((counterparty) => (
                <TableRow key={counterparty.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      to="/controparti/$counterpartyId"
                      params={{ counterpartyId: counterparty.id }}
                      className="font-medium hover:underline"
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
