import { Link } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { ActivityReviewBadge } from "@/components/activity-review-badge";
import { CaseActivityDialog } from "@/components/case-activities";
import { MobileListCard } from "@/components/mobile-list-card";
import { MobileListCardDetails } from "@/components/mobile-list-card-details";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { TableEmptyState } from "@/components/table-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { activityCaseLabel } from "@/lib/case-activities";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseActivityDisplayStatus,
  caseActivityDisplayStatusLabels,
  caseActivityDisplayStatusVariant,
  priceItemKindLabels,
} from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import type { GlobalActivityRow } from "@/routes/attivita.index";

export function ActivityMobileResults({
  rows,
  isLoading,
  hasActiveFilters,
}: {
  rows: GlobalActivityRow[];
  isLoading: boolean;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {isLoading ? (
        <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>
      ) : rows.length === 0 ? (
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
        rows.map((activity) => {
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
  );
}
