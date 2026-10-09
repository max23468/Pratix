import { type PracticeListBodyProps } from "@/components/practices/types";
import { TableRow, TableCell } from "@/components/ui/table";
import { PracticeEmptyState } from "@/components/practices/practice-empty-state";
import { PracticeTableRow } from "@/components/practices/practice-table-row";
import { emptyPracticeActivitySummary } from "@/components/practices/helpers";
import { routeRef } from "@/lib/public-route-code";

export function PracticeTableBody({
  isLoading,
  rows,
  hasFilters,
  activitySummaryByCase,
  onOpen,
}: PracticeListBodyProps & { onOpen: (caseId: string) => void }) {
  if (isLoading || rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
          {isLoading ? "Caricamento…" : <PracticeEmptyState hasFilters={hasFilters} />}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((practice) => (
    <PracticeTableRow
      key={practice.id}
      practice={practice}
      summary={activitySummaryByCase[practice.id] ?? emptyPracticeActivitySummary}
      onOpen={() => onOpen(routeRef(practice))}
    />
  ));
}
