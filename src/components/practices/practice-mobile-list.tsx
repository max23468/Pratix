import { type PracticeListBodyProps, type PracticeWorkflowRow } from "@/components/practices/types";
import { Card } from "@/components/ui/card";
import { PracticeEmptyState } from "@/components/practices/practice-empty-state";
import { PracticeMobileCard } from "@/components/practices/practice-mobile-card";
import { emptyPracticeActivitySummary } from "@/components/practices/helpers";

export function PracticeMobileList({
  isLoading,
  rows,
  hasFilters,
  activitySummaryByCase,
  workflowByCase,
}: PracticeListBodyProps & { workflowByCase: Record<string, PracticeWorkflowRow> }) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <PracticeEmptyState hasFilters={hasFilters} />
      </Card>
    );
  }
  return rows.map((practice) => (
    <PracticeMobileCard
      key={practice.id}
      practice={practice}
      summary={activitySummaryByCase[practice.id] ?? emptyPracticeActivitySummary}
      workflow={workflowByCase[practice.id]}
    />
  ));
}
