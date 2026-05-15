import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { CaseActivityDialog, type CaseActivityDialogActivity } from "@/components/case-activities";
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
import { activityCaseLabel, type CaseActivityContext } from "@/lib/case-activities";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseActivityStatusLabels,
  caseActivityStatusVariant,
  priceItemKindLabels,
} from "@/lib/labels";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";

export const Route = createFileRoute("/attivita/")({
  validateSearch: (search: Record<string, unknown>): ActivitiesSearch => ({
    q: parseTextSearch(search.q),
    status: parseFilterValue(search.status, caseActivityStatusLabels),
    kind: parseFilterValue(search.kind, priceItemKindLabels),
  }),
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

type ActivitiesSearch = {
  q?: string;
  status?: string;
  kind?: string;
};

type GlobalActivityRow = CaseActivityDialogActivity & {
  cases: (CaseActivityContext & { practice_number: number; title: string }) | null;
};

function ActivitiesList() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const q = search.q ?? "";
  const status = search.status ?? "all";
  const kind = search.kind ?? "all";

  const updateSearch = (next: ActivitiesSearch) =>
    navigate({
      search: {
        q: next.q?.trim() ? next.q : undefined,
        status: next.status && next.status !== "all" ? next.status : undefined,
        kind: next.kind && next.kind !== "all" ? next.kind : undefined,
      },
      replace: true,
    });

  const openCase = (caseId: string) => navigate({ to: "/pratiche/$caseId", params: { caseId } });

  const { data = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activities")
        .select(
          "id, case_id, price_book_id, price_item_id, activity_date, kind, status, snapshot_price_year, snapshot_price_code, snapshot_price_name, description, quantity, unit_price, amount, invoice_id, notes, case_activity_hearings(*), activity_attachments(*), cases(id, practice_number, case_number, title, principal_id, client_id, counterparty_id, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name))",
        )
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GlobalActivityRow[];
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
            onChange={(event) => updateSearch({ q: event.target.value, status, kind })}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(value) => updateSearch({ q, status: value, kind })}>
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
        <Select value={kind} onValueChange={(value) => updateSearch({ q, status, kind: value })}>
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
              <TableHead className="w-12" />
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
                  <TableEmptyState
                    title={
                      q || status !== "all" || kind !== "all"
                        ? "Nessuna attività trovata"
                        : "Nessuna attività"
                    }
                    description={
                      q || status !== "all" || kind !== "all"
                        ? "Modifica ricerca o filtri per ampliare i risultati."
                        : "Registra compensi o rimborsi spese dalla pratica o da inserimento rapido."
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
              filtered.map((activity) => {
                const caseId = activity.cases?.id;
                const editTitle = activity.invoice_id
                  ? "Le voci collegate a una Fattura non si modificano"
                  : "Modifica voce";
                return (
                  <TableRow
                    key={activity.id}
                    className={caseId ? "cursor-pointer" : undefined}
                    role={caseId ? "link" : undefined}
                    tabIndex={caseId ? 0 : undefined}
                    aria-label={
                      caseId ? `Apri pratica ${activity.cases?.practice_number}` : undefined
                    }
                    onClick={
                      caseId
                        ? (event) => handleClickableTableRowClick(event, () => openCase(caseId))
                        : undefined
                    }
                    onKeyDown={
                      caseId
                        ? (event) => handleClickableTableRowKeyDown(event, () => openCase(caseId))
                        : undefined
                    }
                  >
                    <TableCell className="text-sm">{formatDate(activity.activity_date)}</TableCell>
                    <TableCell className="text-sm">
                      {activity.cases ? (
                        <Link
                          to="/pratiche/$caseId"
                          params={{ caseId: activity.cases.id }}
                          className="hover:underline"
                        >
                          <div className="font-medium">
                            Pratica {activity.cases.practice_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.cases.title}
                          </div>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <CaseActivityDialog
                        caseRow={activity.cases ?? undefined}
                        activity={activity}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto max-w-full justify-start px-0 py-0 text-left hover:bg-transparent"
                            disabled={Boolean(activity.invoice_id)}
                            aria-label={`Modifica ${activity.description}`}
                            title={editTitle}
                          >
                            <span className="flex min-w-0 flex-col gap-1">
                              <span className="truncate font-medium">{activity.description}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {priceItemKindLabels[activity.kind]} ·{" "}
                                {activity.snapshot_price_name}
                              </span>
                            </span>
                          </Button>
                        }
                      />
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
                    <TableCell className="text-right">
                      <CaseActivityDialog
                        caseRow={activity.cases ?? undefined}
                        activity={activity}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={Boolean(activity.invoice_id)}
                            aria-label={`Modifica ${activity.description}`}
                            title={editTitle}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })
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

function parseTextSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 120);
  return normalized || undefined;
}

function parseFilterValue(value: unknown, labels: Record<string, string>) {
  if (typeof value !== "string") return undefined;
  return value in labels ? value : undefined;
}
