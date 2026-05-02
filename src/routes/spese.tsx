import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ExpenseDialog } from "@/components/expense-form";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { expenseCategoryLabels, clientDisplayName } from "@/lib/labels";

export const Route = createFileRoute("/spese")({
  head: () => ({
    meta: [
      { title: "Spese · Pratix" },
      { name: "description", content: "Tutte le spese delle tue pratiche." },
      { property: "og:title", content: "Spese · Pratix" },
      { property: "og:description", content: "Tutte le spese delle tue pratiche." },
    ],
  }),
  component: () => (
    <AppLayout>
      <SpeseList />
    </AppLayout>
  ),
});

function SpeseList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id, expense_date, category, description, amount, is_art15, case_id, cases(id, case_number, title, clients(kind, first_name, last_name, business_name))",
        )
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.filter((e) => {
      if (type === "art15" && !e.is_art15) return false;
      if (type === "taxable" && e.is_art15) return false;
      if (!term) return true;
      const caseTitle = e.cases?.title?.toLowerCase() ?? "";
      const caseNum = e.cases?.case_number?.toLowerCase() ?? "";
      return (
        e.description.toLowerCase().includes(term) ||
        caseTitle.includes(term) ||
        caseNum.includes(term)
      );
    });
  }, [data, q, type]);

  const totals = filtered.reduce(
    (acc, e) => {
      const amt = Number(e.amount) || 0;
      if (e.is_art15) acc.art15 += amt;
      else acc.taxable += amt;
      return acc;
    },
    { taxable: 0, art15: 0 },
  );

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spesa eliminata");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Spese"
        description="Tutte le spese registrate, divise tra imponibili e anticipazioni Art. 15."
        actions={<ExpenseDialog />}
      />

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

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per descrizione o pratica…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="taxable">Imponibili</SelectItem>
            <SelectItem value="art15">Anticipazioni Art. 15</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Pratica</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead></TableHead>
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
                  Nessuna spesa registrata.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{formatDate(e.expense_date)}</TableCell>
                  <TableCell className="text-sm">
                    {e.cases ? (
                      <Link
                        to="/pratiche/$caseId"
                        params={{ caseId: e.cases.id }}
                        className="hover:underline"
                      >
                        <div className="font-medium">{e.cases.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.cases.case_number}
                          {e.cases.clients ? ` · ${clientDisplayName(e.cases.clients)}` : ""}
                        </div>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
