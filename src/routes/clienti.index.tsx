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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableEmptyState } from "@/components/table-empty-state";
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
  const [kind, setKind] = useState("all");
  const [principalId, setPrincipalId] = useState("all");

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

  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "client-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name, archived_at")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: principalLinks = [] } = useQuery({
    queryKey: ["principal-clients", "client-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principal_clients")
        .select("client_id, principal_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const principalNamesByClient = useMemo(() => {
    const principalsById = new Map(principals.map((principal) => [principal.id, principal]));
    return principalLinks.reduce<Record<string, string[]>>((acc, link) => {
      const principal = principalsById.get(link.principal_id);
      if (!principal) return acc;
      acc[link.client_id] = [...(acc[link.client_id] ?? []), principal.business_name];
      return acc;
    }, {});
  }, [principalLinks, principals]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.filter((c) => {
      if (kind !== "all" && c.kind !== kind) return false;
      if (
        principalId !== "all" &&
        !principalLinks.some((link) => link.client_id === c.id && link.principal_id === principalId)
      ) {
        return false;
      }
      const name = clientDisplayName(c).toLowerCase();
      const principalNames = principalNamesByClient[c.id]?.join(" ").toLowerCase() ?? "";
      if (!term) return true;
      return (
        name.includes(term) ||
        principalNames.includes(term) ||
        (c.tax_code ?? "").toLowerCase().includes(term) ||
        (c.vat_number ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, kind, principalId, principalLinks, principalNamesByClient, q]);

  return (
    <>
      <PageHeader
        title="Clienti"
        description="Anagrafica dei tuoi clienti."
        actions={
          <Link to="/clienti/nuovo">
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Nuovo cliente
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, CF, P.IVA, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {Object.entries(clientKindLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={principalId} onValueChange={setPrincipalId}>
          <SelectTrigger className="lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i committenti</SelectItem>
            {principals.map((principal) => (
              <SelectItem key={principal.id} value={principal.id}>
                {principal.business_name}
                {principal.archived_at ? " (archiviato)" : ""}
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
              <TableHead>Committenti</TableHead>
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
                      q || kind !== "all" || principalId !== "all"
                        ? "Nessun cliente trovato"
                        : "Nessun cliente"
                    }
                    description={
                      q || kind !== "all" || principalId !== "all"
                        ? "Modifica ricerca o filtri per ampliare i risultati."
                        : "Aggiungi il primo cliente e collegalo a uno o più committenti."
                    }
                    action={
                      !q && kind === "all" && principalId === "all" ? (
                        <Button size="sm" asChild>
                          <Link to="/clienti/nuovo">Nuovo cliente</Link>
                        </Button>
                      ) : undefined
                    }
                  />
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
                    {principalNamesByClient[c.id]?.join(", ") || "—"}
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
