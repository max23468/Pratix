import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { ListToolbar } from "@/components/list-toolbar";
import { PageHeader } from "@/components/page-header";
import {
  ActivityReviewBadge,
  CaseActivityDialog,
  type CaseActivityDialogActivity,
} from "@/components/case-activities";
import { MobileListCard } from "@/components/mobile-list-card";
import { MobileListCardDetails } from "@/components/mobile-list-card-details";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { SearchInput } from "@/components/search-input";
import { SortableTableHead } from "@/components/sortable-table-head";
import { SummaryTile } from "@/components/summary-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  activityCaseLabel,
  activityCasePartiesLabel,
  type CaseActivityContext,
} from "@/lib/case-activities";
import { formatCurrency, formatDate } from "@/lib/format";
import { routeRef } from "@/lib/public-route-code";
import {
  caseActivityDisplayStatus,
  caseActivityDisplayStatusLabels,
  caseActivityDisplayStatusVariant,
  practiceDisplayName,
  priceItemKindLabels,
} from "@/lib/labels";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import {
  parseTableSortDirection,
  parseTableSortKey,
  sortRows,
  usePersistentTableSort,
  type SortableColumn,
  type TableSort,
} from "@/lib/table-sorting";

const attivitaSortKeys = [
  "activity_date",
  "case",
  "activity",
  "status",
  "quantity",
  "amount",
] as const;

type AttivitaSortKey = (typeof attivitaSortKeys)[number];

const attivitaDefaultSort: TableSort<AttivitaSortKey> = {
  key: "activity_date",
  direction: "desc",
};

export const Route = createFileRoute("/attivita/")({
  validateSearch: (search: Record<string, unknown>): ActivitiesSearch => ({
    q: parseTextSearch(search.q),
    status: parseFilterValue(search.status, caseActivityDisplayStatusLabels),
    kind: parseFilterValue(search.kind, priceItemKindLabels),
    attachments: parseAttachmentsSearch(search.attachments),
    review: parseReviewSearch(search.review),
    sort: parseTableSortKey(search.sort, attivitaSortKeys),
    dir: parseTableSortDirection(search.dir),
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
  attachments?: "missing" | "all";
  review?: "needs_review" | "all";
  sort?: AttivitaSortKey;
  dir?: "asc" | "desc";
};

type GlobalActivityRow = CaseActivityDialogActivity & {
  cases: (CaseActivityContext & { public_code: string; practice_number: number }) | null;
};

function ActivitiesList() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const q = search.q ?? "";
  const status = search.status ?? "all";
  const kind = search.kind ?? "all";
  const attachments = search.attachments ?? "all";
  const review = search.review ?? "all";
  const urlSort =
    search.sort && search.dir ? { key: search.sort, direction: search.dir } : undefined;
  const hasActiveFilters =
    Boolean(q) || status !== "all" || kind !== "all" || attachments !== "all" || review !== "all";

  const updateSearch = (next: ActivitiesSearch) =>
    navigate({
      search: {
        q: next.q?.trim() ? next.q : undefined,
        status: next.status && next.status !== "all" ? next.status : undefined,
        kind: next.kind && next.kind !== "all" ? next.kind : undefined,
        attachments: next.attachments && next.attachments !== "all" ? next.attachments : undefined,
        review: next.review && next.review !== "all" ? next.review : undefined,
        sort: next.sort ?? search.sort,
        dir: next.dir ?? search.dir,
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
          "id, case_id, price_book_id, price_item_id, activity_date, kind, status, needs_review, snapshot_price_year, snapshot_price_code, snapshot_price_name, description, quantity, unit_price, amount, invoice_id, notes, case_activity_hearings(*), activity_attachments(*), cases(id, public_code, practice_number, principal_id, client_id, counterparty_id, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name))",
        )
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GlobalActivityRow[];
    },
  });

  const attivitaColumns = useMemo<readonly SortableColumn<GlobalActivityRow, AttivitaSortKey>[]>(
    () => [
      {
        key: "activity_date",
        label: "Data",
        valueType: "date",
        defaultDirection: "desc",
        getValue: (activity) => activity.activity_date,
      },
      {
        key: "case",
        label: "Pratica",
        valueType: "number",
        getValue: (activity) => activity.cases?.practice_number,
      },
      { key: "activity", label: "Attività", getValue: (activity) => activity.description },
      {
        key: "status",
        label: "Stato",
        getValue: (activity) => {
          const displayStatus = caseActivityDisplayStatus(activity);
          return caseActivityDisplayStatusLabels[displayStatus] ?? displayStatus;
        },
      },
      {
        key: "quantity",
        label: "Quantità",
        valueType: "number",
        getValue: (activity) => activity.quantity,
      },
      {
        key: "amount",
        label: "Totale",
        valueType: "number",
        defaultDirection: "desc",
        getValue: (activity) => activity.amount,
      },
    ],
    [],
  );

  const { sort, setSort } = usePersistentTableSort({
    section: "attivita",
    columns: attivitaColumns,
    defaultSort: attivitaDefaultSort,
    urlSort,
    onSortChange: (next) =>
      updateSearch({ q, status, kind, attachments, review, sort: next.key, dir: next.direction }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((activity) => {
      if (status !== "all" && caseActivityDisplayStatus(activity) !== status) return false;
      if (kind !== "all" && activity.kind !== kind) return false;
      if (review === "needs_review" && !activity.needs_review) return false;
      if (
        attachments === "missing" &&
        (activity.kind !== "expense_reimbursement" ||
          (activity.activity_attachments ?? []).length > 0)
      ) {
        return false;
      }
      if (!term) return true;

      const caseLabel = activity.cases ? activityCaseLabel(activity.cases).toLowerCase() : "";
      return (
        activity.description.toLowerCase().includes(term) ||
        activity.snapshot_price_name.toLowerCase().includes(term) ||
        (activity.needs_review && "da verificare".includes(term)) ||
        caseLabel.includes(term)
      );
    });
  }, [attachments, data, kind, q, review, status]);

  const sorted = useMemo(
    () => sortRows(filtered, attivitaColumns, sort),
    [attivitaColumns, filtered, sort],
  );

  const totals = filtered.reduce(
    (acc, activity) => {
      const amount = Number(activity.amount) || 0;
      if (activity.kind === "fee") acc.fees += amount;
      else acc.reimbursements += amount;
      if (activity.status === "to_invoice" && !activity.invoice_id) acc.toInvoice += amount;
      if (activity.needs_review) acc.needsReview += 1;
      return acc;
    },
    { fees: 0, reimbursements: 0, toInvoice: 0, needsReview: 0 },
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

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <SummaryTile label="Compensi" value={formatCurrency(totals.fees)} />
        <SummaryTile label="Rimborsi spese" value={formatCurrency(totals.reimbursements)} />
        <SummaryTile label="Da fatturare" value={formatCurrency(totals.toInvoice)} tone="gold" />
        <SummaryTile label="Da verificare" value={String(totals.needsReview)} />
      </div>

      <ListToolbar>
        <SearchInput
          placeholder="Cerca per pratica, voce, committente, cliente…"
          value={q}
          onChange={(value) => updateSearch({ q: value, status, kind, attachments, review })}
          className="max-w-md"
        />
        <Select
          value={status}
          onValueChange={(value) => updateSearch({ q, status: value, kind, attachments, review })}
        >
          <SelectTrigger aria-label="Filtra attività per stato" className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(caseActivityDisplayStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={kind}
          onValueChange={(value) => updateSearch({ q, status, kind: value, attachments, review })}
        >
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
        <Select
          value={attachments}
          onValueChange={(value) =>
            updateSearch({
              q,
              status,
              kind,
              attachments: value as "all" | "missing",
              review,
            })
          }
        >
          <SelectTrigger aria-label="Filtra attività per allegati" className="lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli allegati</SelectItem>
            <SelectItem value="missing">Senza allegato</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={review}
          onValueChange={(value) =>
            updateSearch({
              q,
              status,
              kind,
              attachments,
              review: value as "all" | "needs_review",
            })
          }
        >
          <SelectTrigger aria-label="Filtra attività da verificare" className="lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le verifiche</SelectItem>
            <SelectItem value="needs_review">Da verificare</SelectItem>
          </SelectContent>
        </Select>
      </ListToolbar>

      <div className="mb-4 md:hidden">
        <MobileSortSelect columns={attivitaColumns} sort={sort} onSort={setSort} />
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>
        ) : sorted.length === 0 ? (
          <Card className="p-4">
            <TableEmptyState
              title={hasActiveFilters ? "Nessuna attività trovata" : "Nessuna attività"}
              description={
                hasActiveFilters
                  ? "Modifica ricerca o filtri per ampliare i risultati."
                  : "Registra compensi o rimborsi spese dalla pratica o da inserimento rapido."
              }
              action={
                !hasActiveFilters ? (
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
          </Card>
        ) : (
          sorted.map((activity) => {
            const caseRef = activity.cases ? routeRef(activity.cases) : null;
            const editTitle = activity.invoice_id
              ? "Le voci collegate a una Fattura non si modificano"
              : "Modifica voce";
            const displayStatus = caseActivityDisplayStatus(activity);
            return (
              <MobileListCard key={activity.id}>
                <MobileListCardHeader
                  eyebrow={formatDate(activity.activity_date)}
                  title={activity.description}
                  subtitle={`${priceItemKindLabels[activity.kind]} · ${activity.snapshot_price_name}`}
                  badge={
                    <Badge variant={caseActivityDisplayStatusVariant[displayStatus] ?? "outline"}>
                      {caseActivityDisplayStatusLabels[displayStatus] ?? displayStatus}
                    </Badge>
                  }
                />
                {activity.needs_review ? (
                  <div className="mt-2">
                    <ActivityReviewBadge needsReview={activity.needs_review} />
                  </div>
                ) : null}
                <MobileListCardDetails
                  rows={[
                    {
                      label: "Pratica",
                      value: activity.cases ? activityCaseLabel(activity.cases) : "—",
                    },
                    { label: "Quantità", value: activity.quantity },
                    {
                      label: "Totale",
                      value: formatCurrency(Number(activity.amount)),
                      valueClassName: "font-medium text-foreground",
                    },
                  ]}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {caseRef && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/pratiche/$caseId" params={{ caseId: caseRef }}>
                        Apri pratica
                      </Link>
                    </Button>
                  )}
                  <CaseActivityDialog
                    caseRow={activity.cases ?? undefined}
                    activity={activity}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(activity.invoice_id)}
                        title={editTitle}
                      >
                        <Pencil className="mr-1 size-4" />
                        Modifica
                      </Button>
                    }
                  />
                </div>
              </MobileListCard>
            );
          })
        )}
      </div>

      <Card className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                columnKey="activity_date"
                label="Data"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="case" label="Pratica" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="activity"
                label="Attività"
                sort={sort}
                onSort={setSort}
              />
              <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={setSort} />
              <SortableTableHead
                columnKey="quantity"
                label="Quantità"
                sort={sort}
                onSort={setSort}
                align="right"
                className="text-right"
              />
              <SortableTableHead
                columnKey="amount"
                label="Totale"
                sort={sort}
                onSort={setSort}
                align="right"
                className="text-right"
              />
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
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <TableEmptyState
                    title={hasActiveFilters ? "Nessuna attività trovata" : "Nessuna attività"}
                    description={
                      hasActiveFilters
                        ? "Modifica ricerca o filtri per ampliare i risultati."
                        : "Registra compensi o rimborsi spese dalla pratica o da inserimento rapido."
                    }
                    action={
                      !hasActiveFilters ? (
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
              sorted.map((activity) => {
                const caseRef = activity.cases ? routeRef(activity.cases) : null;
                const editTitle = activity.invoice_id
                  ? "Le voci collegate a una Fattura non si modificano"
                  : "Modifica voce";
                const displayStatus = caseActivityDisplayStatus(activity);
                return (
                  <TableRow
                    key={activity.id}
                    className={caseRef ? "cursor-pointer" : undefined}
                    role={caseRef ? "link" : undefined}
                    tabIndex={caseRef ? 0 : undefined}
                    aria-label={
                      caseRef ? `Apri pratica ${activity.cases?.practice_number}` : undefined
                    }
                    onClick={
                      caseRef
                        ? (event) => handleClickableTableRowClick(event, () => openCase(caseRef))
                        : undefined
                    }
                    onKeyDown={
                      caseRef
                        ? (event) => handleClickableTableRowKeyDown(event, () => openCase(caseRef))
                        : undefined
                    }
                  >
                    <TableCell className="text-sm">{formatDate(activity.activity_date)}</TableCell>
                    <TableCell className="text-sm">
                      {activity.cases ? (
                        <Link
                          to="/pratiche/$caseId"
                          params={{ caseId: routeRef(activity.cases) }}
                          className="hover:underline"
                        >
                          <div className="font-medium">{practiceDisplayName(activity.cases)}</div>
                          <div className="text-xs text-muted-foreground">
                            {activityCasePartiesLabel(activity.cases)}
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
                            className="h-auto max-w-full justify-start p-0 text-left hover:bg-transparent"
                            disabled={Boolean(activity.invoice_id)}
                            aria-label={`Modifica ${activity.description}`}
                            title={editTitle}
                          >
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="truncate font-medium">{activity.description}</span>
                              <ActivityReviewBadge needsReview={activity.needs_review} />
                              <span className="truncate text-xs text-muted-foreground">
                                {priceItemKindLabels[activity.kind]} ·{" "}
                                {activity.snapshot_price_name}
                              </span>
                            </div>
                          </Button>
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={caseActivityDisplayStatusVariant[displayStatus] ?? "outline"}>
                        {caseActivityDisplayStatusLabels[displayStatus] ?? displayStatus}
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

function parseTextSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 120);
  return normalized || undefined;
}

function parseFilterValue(value: unknown, labels: Record<string, string>) {
  if (typeof value !== "string") return undefined;
  return value in labels ? value : undefined;
}

function parseAttachmentsSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value === "missing" ? value : undefined;
}

function parseReviewSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value === "needs_review" ? value : undefined;
}
