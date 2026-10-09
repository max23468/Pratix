import { type CounterpartyListRow } from "@/components/counterparties/types";
import { counterpartyDisplayName, counterpartyKindLabels } from "@/lib/labels";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { Badge } from "@/components/ui/badge";

export function CounterpartyTableRow({
  counterparty,
  subjectCount,
  onOpen,
}: {
  counterparty: CounterpartyListRow;
  subjectCount: number;
  onOpen: () => void;
}) {
  const displayName = counterpartyDisplayName(counterparty);
  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={(event) => handleClickableTableRowClick(event, onOpen)}
      onKeyDown={(event) => handleClickableTableRowKeyDown(event, onOpen)}
    >
      <TableCell>
        <Link
          to="/controparti/$counterpartyId"
          params={{ counterpartyId: routeRef(counterparty) }}
          className="font-medium hover:underline"
        >
          {displayName}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {counterpartyKindLabels[counterparty.kind] ?? counterparty.kind}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {counterparty.kind === "group" ? subjectCount : "—"}
      </TableCell>
      <TableCell className="max-w-sm truncate text-sm text-muted-foreground">
        {counterparty.notes ?? "—"}
      </TableCell>
    </TableRow>
  );
}
