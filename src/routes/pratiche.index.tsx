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
  const [status, setStatus] = useState<string>("all");

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

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
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
  }, [data, q, status]);

  return (
    <>
      <PageHeader
        title="Pratiche"
        description="Tutte le tue pratiche in un unico posto."
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
            placeholder="Cerca per numero, committente, cliente, controparte…"
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
              <SelectItem key={k} value={k}>
                {l}
              </SelectItem>
            ))}
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
              <TableHead>Aperta il</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  {q || status !== "all" ? "Nessun risultato." : "Nessuna pratica. Crea la prima."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
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
