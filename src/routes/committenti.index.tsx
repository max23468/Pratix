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

export const Route = createFileRoute("/committenti/")({
  head: () => ({
    meta: [
      { title: "Committenti · Pratix" },
      {
        name: "description",
        content: "Gestisci i committenti e le loro regole economiche.",
      },
      { property: "og:title", content: "Committenti · Pratix" },
      {
        property: "og:description",
        content: "Gestisci i committenti e le loro regole economiche.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <CommittentiList />
    </AppLayout>
  ),
});

function CommittentiList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [economics, setEconomics] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["principals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select(
          "id, business_name, tax_code, vat_number, email, address_city, fees_enabled, expense_reimbursements_enabled, archived_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!data) return [];
    return data.filter((principal) => {
      if (status === "active" && principal.archived_at) return false;
      if (status === "archived" && !principal.archived_at) return false;
      if (economics === "fees" && !principal.fees_enabled) return false;
      if (economics === "expenses" && !principal.expense_reimbursements_enabled) return false;
      if (
        economics === "fees_only" &&
        (!principal.fees_enabled || principal.expense_reimbursements_enabled)
      ) {
        return false;
      }
      if (
        economics === "expenses_only" &&
        (principal.fees_enabled || !principal.expense_reimbursements_enabled)
      ) {
        return false;
      }
      if (!term) return true;
      return [
        principal.business_name,
        principal.tax_code,
        principal.vat_number,
        principal.email,
        principal.address_city,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term));
    });
  }, [data, economics, q, status]);

  return (
    <>
      <PageHeader
        title="Committenti"
        description="Società a cui fatturare compensi e rimborsi spese."
        actions={
          <Link to="/committenti/nuovo">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nuovo committente
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per ragione sociale, CF, P.IVA, email…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivi</SelectItem>
            <SelectItem value="archived">Archiviati</SelectItem>
          </SelectContent>
        </Select>
        <Select value={economics} onValueChange={setEconomics}>
          <SelectTrigger className="lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le regole</SelectItem>
            <SelectItem value="fees">Con compensi</SelectItem>
            <SelectItem value="expenses">Con rimborsi</SelectItem>
            <SelectItem value="fees_only">Solo compensi</SelectItem>
            <SelectItem value="expenses_only">Solo rimborsi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ragione sociale</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Regole economiche</TableHead>
              <TableHead>CF / P.IVA</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Città</TableHead>
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
                  <TableEmptyState
                    title={
                      q || status !== "active" || economics !== "all"
                        ? "Nessun committente trovato"
                        : "Nessun committente"
                    }
                    description={
                      q || status !== "active" || economics !== "all"
                        ? "Modifica ricerca o filtri per ampliare i risultati."
                        : "Aggiungi il primo committente per configurare prezzi, clienti e pratiche."
                    }
                    action={
                      !q && status === "active" && economics === "all" ? (
                        <Button size="sm" asChild>
                          <Link to="/committenti/nuovo">Nuovo committente</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((principal) => (
                <TableRow key={principal.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      to="/committenti/$principalId"
                      params={{ principalId: principal.id }}
                      className="font-medium hover:underline"
                    >
                      {principal.business_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={principal.archived_at ? "secondary" : "outline"}>
                      {principal.archived_at ? "Archiviato" : "Attivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {economicRulesLabel(principal)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {principal.vat_number || principal.tax_code || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {principal.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {principal.address_city ?? "—"}
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

function economicRulesLabel(principal: {
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
}) {
  if (principal.fees_enabled && principal.expense_reimbursements_enabled) {
    return "Compensi e rimborsi";
  }
  if (principal.fees_enabled) return "Solo compensi";
  if (principal.expense_reimbursements_enabled) return "Solo rimborsi";
  return "Nessuna regola";
}
