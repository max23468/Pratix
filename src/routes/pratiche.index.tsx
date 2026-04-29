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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  caseMatterLabels,
  caseStatusLabels,
  caseStatusVariant,
  clientDisplayName,
} from "@/lib/labels";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/pratiche/")({
  head: () => ({
    meta: [
      { title: "Pratiche — Pratix" },
      { name: "description", content: "Tutte le pratiche del tuo studio." },
      { property: "og:title", content: "Pratiche — Pratix" },
      { property: "og:description", content: "Tutte le pratiche del tuo studio." },
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
  const [status, setStatus] = useState<string>("all");
  const [matter, setMatter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, case_number, title, status, matter, opened_at, updated_at, client_id, clients(kind, first_name, last_name, business_name)",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (matter !== "all" && c.matter !== matter) return false;
      if (!term) return true;
      const clientName = c.clients ? clientDisplayName(c.clients).toLowerCase() : "";
      return (
        c.title.toLowerCase().includes(term) ||
        c.case_number.toLowerCase().includes(term) ||
        clientName.includes(term)
      );
    });
  }, [data, q, status, matter]);

  return (
    <>
      <PageHeader
        title="Pratiche"
        description="Tutte le pratiche del tuo studio."
        actions={
          <Link to="/pratiche/nuova">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nuova pratica
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per numero, titolo, cliente…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(caseStatusLabels).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={matter} onValueChange={setMatter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le materie</SelectItem>
            {Object.entries(caseMatterLabels).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numero</TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Materia</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Aperta il</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {q || status !== "all" || matter !== "all"
                    ? "Nessun risultato."
                    : "Nessuna pratica. Crea la prima."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.case_number}
                  </TableCell>
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
                    {c.clients ? clientDisplayName(c.clients) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {caseMatterLabels[c.matter] ?? c.matter}
                  </TableCell>
                  <TableCell>
                    <Badge variant={caseStatusVariant[c.status] ?? "outline"}>
                      {caseStatusLabels[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(c.opened_at)}
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
