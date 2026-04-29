import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/lib/auth-context";
import {
  clientDisplayName,
  invoiceStatusLabels,
  invoiceStatusVariant,
} from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/fatture/")({
  component: InvoicesIndex,
});

function InvoicesIndex() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, number, year, issue_date, due_date, status, total_amount, net_to_pay, client:clients(id, kind, first_name, last_name, business_name)",
        )
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const years = useMemo(() => {
    const set = new Set<number>();
    (data || []).forEach((i) => set.add(i.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (year !== "all" && String(i.year) !== year) return false;
      if (!q) return true;
      const name = clientDisplayName(i.client as any).toLowerCase();
      return i.number.toLowerCase().includes(q) || name.includes(q);
    });
  }, [data, search, status, year]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, i) => {
        acc.total += Number(i.total_amount);
        acc.net += Number(i.net_to_pay);
        if (i.status === "paid") acc.paid += Number(i.total_amount);
        return acc;
      },
      { total: 0, net: 0, paid: 0 },
    );
  }, [filtered]);

  return (
    <AppLayout>
      <PageHeader
        title="Fatture"
        description="Emetti, traccia e scarica le fatture in PDF e XML SdI."
        action={
          <Button asChild>
            <Link to="/fatture/nuova">
              <Plus className="mr-2 h-4 w-4" /> Nuova fattura
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Totale documenti</div>
            <div className="text-2xl font-semibold">{formatCurrency(totals.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Netto a pagare</div>
            <div className="text-2xl font-semibold">{formatCurrency(totals.net)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Incassato (pagate)</div>
            <div className="text-2xl font-semibold">{formatCurrency(totals.paid)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca per numero o cliente"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {Object.entries(invoiceStatusLabels).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="sm:w-32">
                <SelectValue placeholder="Anno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Caricamento…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nessuna fattura trovata.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        to="/fatture/$invoiceId"
                        params={{ invoiceId: i.id }}
                        className="font-medium hover:underline"
                      >
                        {i.number}/{i.year}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(i.issue_date)}</TableCell>
                    <TableCell>{clientDisplayName(i.client as any)}</TableCell>
                    <TableCell>{formatDate(i.due_date)}</TableCell>
                    <TableCell>
                      <Badge variant={invoiceStatusVariant[i.status] || "outline"}>
                        {invoiceStatusLabels[i.status] || i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(i.total_amount))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(i.net_to_pay))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
