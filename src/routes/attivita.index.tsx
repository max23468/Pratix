import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { CaseActivityDialog } from "@/components/case-activities";
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
import { activityCaseLabel } from "@/lib/case-activities";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseActivityStatusLabels,
  caseActivityStatusVariant,
  priceItemKindLabels,
} from "@/lib/labels";

export const Route = createFileRoute("/attivita/")({
  head: () => ({
    meta: [
      { title: "Attività · Pratix" },
      {
        name: "description",
        content: "Inserisci e controlla compensi e rimborsi spese delle pratiche.",
      },
      { property: "og:title", content: "Attività · Pratix" },
      {
        property: "og:description",
        content: "Inserisci e controlla compensi e rimborsi spese delle pratiche.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <ActivitiesList />
    </AppLayout>
  ),
});

function ActivitiesList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activities")
        .select(
          "id, activity_date, kind, status, snapshot_price_code, snapshot_price_name, description, quantity, unit_price, amount, case_id, cases(id, practice_number, case_number, title, principal_id, client_id, counterparty_id, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name))",
        )
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((activity) => {
      if (status !== "all" && activity.status !== status) return false;
      if (kind !== "all" && activity.kind !== kind) return false;
      if (!term) return true;

      const caseLabel = activity.cases ? activityCaseLabel(activity.cases).toLowerCase() : "";
      return (
        activity.description.toLowerCase().includes(term) ||
        activity.snapshot_price_name.toLowerCase().includes(term) ||
        activity.snapshot_price_code.toLowerCase().includes(term) ||
        caseLabel.includes(term)
      );
    });
  }, [data, kind, q, status]);

  const totals = filtered.reduce(
    (acc, activity) => {
      const amount = Number(activity.amount) || 0;
      if (activity.kind === "fee") acc.fees += amount;
      else acc.reimbursements += amount;
      if (activity.status === "to_invoice") acc.toInvoice += amount;
      return acc;
    },
    { fees: 0, reimbursements: 0, toInvoice: 0 },
  );

  return (
    <>
      <PageHeader
        title="Attività"
        description="Inserimento rapido e controllo delle voci fatturabili delle pratiche."
        actions={
          <CaseActivityDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-1 size-4" /> Nuova attività
              </Button>
            }
          />
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <SummaryTile label="Compensi" value={totals.fees} />
        <SummaryTile label="Rimborsi spese" value={totals.reimbursements} />
        <SummaryTile label="Da fatturare" value={totals.toInvoice} />
      </div>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per pratica, voce, committente, cliente…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtra attività per stato" className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(caseActivityStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger aria-label="Filtra attività per tipo" className="lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {Object.entries(priceItemKindLabels).map(([value, label]) => (
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
              <TableHead>Data</TableHead>
              <TableHead>Pratica</TableHead>
              <TableHead>Attività</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="text-right">Quantità</TableHead>
              <TableHead className="text-right">Totale</TableHead>
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
                      q || status !== "all" || kind !== "all"
                        ? "Nessuna attività trovata"
                        : "Nessuna attività"
                    }
                    description={
                      q || status !== "all" || kind !== "all"
                        ? "Modifica ricerca o filtri per ampliare i risultati."
                        : "Registra compensi e rimborsi spese dalla pratica o da inserimento rapido."
                    }
                    action={
                      !q && status === "all" && kind === "all" ? (
                        <CaseActivityDialog
                          trigger={
                            <Button size="sm">
                              <Plus className="mr-1 size-4" /> Nuova attività
                            </Button>
                          }
                        />
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="text-sm">{formatDate(activity.activity_date)}</TableCell>
                  <TableCell className="text-sm">
                    {activity.cases ? (
                      <Link
                        to="/pratiche/$caseId"
                        params={{ caseId: activity.cases.id }}
                        className="hover:underline"
                      >
                        <div className="font-medium">Pratica {activity.cases.practice_number}</div>
                        <div className="text-xs text-muted-foreground">{activity.cases.title}</div>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{activity.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {priceItemKindLabels[activity.kind]} · {activity.snapshot_price_code}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={caseActivityStatusVariant[activity.status] ?? "outline"}>
                      {caseActivityStatusLabels[activity.status] ?? activity.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{activity.quantity}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(Number(activity.amount))}
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

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}
