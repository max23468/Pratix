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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { clientDisplayName, clientKindLabels } from "@/lib/labels";

export const Route = createFileRoute("/clienti/")({
  head: () => ({
    meta: [
      { title: "Clienti · Pratix" },
      { name: "description", content: "Gestisci la rubrica dei tuoi clienti." },
      { property: "og:title", content: "Clienti · Pratix" },
      { property: "og:description", content: "Gestisci la rubrica dei tuoi clienti." },
    ],
  }),
  component: () => (
    <AppLayout>
      <ClientiList />
    </AppLayout>
  ),
});

function ClientiList() {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((c) => {
      const name = clientDisplayName(c).toLowerCase();
      return (
        name.includes(term) ||
        (c.tax_code ?? "").toLowerCase().includes(term) ||
        (c.vat_number ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, q]);

  return (
    <>
      <PageHeader
        title="Clienti"
        description="Anagrafica dei tuoi clienti."
        actions={
          <Link to="/clienti/nuovo">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nuovo cliente
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, CF, P.IVA, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
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
              <TableHead>CF / P.IVA</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Città</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {q ? "Nessun risultato." : "Nessun cliente. Aggiungi il primo."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      to="/clienti/$clientId"
                      params={{ clientId: c.id }}
                      className="font-medium hover:underline"
                    >
                      {clientDisplayName(c)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{clientKindLabels[c.kind] ?? c.kind}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.vat_number || c.tax_code || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.address_city ?? "—"}
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
