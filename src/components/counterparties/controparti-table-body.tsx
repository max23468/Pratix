import { type ContropartiListBodyProps } from "@/components/counterparties/types";
import { TableRow, TableCell } from "@/components/ui/table";
import { ContropartiEmptyState } from "@/components/counterparties/controparti-empty-state";
import { CounterpartyTableRow } from "@/components/counterparties/counterparty-table-row";
import { routeRef } from "@/lib/public-route-code";

export function ContropartiTableBody({
  isLoading,
  rows,
  hasFilters,
  subjectCounts,
  onOpen,
}: ContropartiListBodyProps & { onOpen: (counterpartyId: string) => void }) {
  if (isLoading || rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
          {isLoading ? "Caricamento…" : <ContropartiEmptyState hasFilters={hasFilters} />}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((counterparty) => (
    <CounterpartyTableRow
      key={counterparty.id}
      counterparty={counterparty}
      subjectCount={subjectCounts[counterparty.id] ?? 0}
      onOpen={() => onOpen(routeRef(counterparty))}
    />
  ));
}
