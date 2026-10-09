import { type CommittentiListBodyProps } from "@/components/principals/types";
import { TableRow, TableCell } from "@/components/ui/table";
import { CommittentiEmptyState } from "@/components/principals/committenti-empty-state";
import { PrincipalTableRow } from "@/components/principals/principal-table-row";
import { routeRef } from "@/lib/public-route-code";

export function CommittentiTableBody({
  isLoading,
  rows,
  hasFilters,
  onOpen,
}: CommittentiListBodyProps & { onOpen: (principalId: string) => void }) {
  if (isLoading || rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
          {isLoading ? "Caricamento…" : <CommittentiEmptyState hasFilters={hasFilters} />}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((principal) => (
    <PrincipalTableRow
      key={principal.id}
      principal={principal}
      onOpen={() => onOpen(routeRef(principal))}
    />
  ));
}
