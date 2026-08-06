import { Link } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { ActivityReviewBadge } from "@/components/activity-review-badge";
import { CaseActivityDialog } from "@/components/case-activities";
import { SortableTableHead } from "@/components/sortable-table-head";
import { TableEmptyState } from "@/components/table-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activityCasePartiesLabel } from "@/lib/case-activities";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseActivityDisplayStatus,
  caseActivityDisplayStatusLabels,
  caseActivityDisplayStatusVariant,
  practiceDisplayName,
  priceItemKindLabels,
} from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import type { TableSort } from "@/lib/table-sorting";
import type { AttivitaSortKey, GlobalActivityRow } from "@/routes/attivita.index";

export function ActivityTableResults({
  rows,
  isLoading,
  hasActiveFilters,
  sort,
  onSort,
  onOpen,
}: {
  rows: GlobalActivityRow[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  sort: TableSort<AttivitaSortKey>;
  onSort: (columnKey: AttivitaSortKey) => void;
  onOpen: (caseRef: string) => void;
}) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead columnKey="activity_date" label="Data" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="case" label="Pratica" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="activity" label="Attività" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={onSort} />
            <SortableTableHead
              columnKey="quantity"
              label="Quantità"
              sort={sort}
              onSort={onSort}
              align="right"
              className="text-right"
            />
            <SortableTableHead
              columnKey="amount"
              label="Totale"
              sort={sort}
              onSort={onSort}
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
          ) : rows.length === 0 ? (
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
            rows.map((activity) => {
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
                      ? (event) => handleClickableTableRowClick(event, () => onOpen(caseRef))
                      : undefined
                  }
                  onKeyDown={
                    caseRef
                      ? (event) => handleClickableTableRowKeyDown(event, () => onOpen(caseRef))
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
                              {priceItemKindLabels[activity.kind]} · {activity.snapshot_price_name}
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
  );
}
