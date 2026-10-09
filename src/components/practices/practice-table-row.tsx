import { type PracticeListRow, type PracticeActivitySummary } from "@/components/practices/types";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { clientDisplayName, counterpartyDisplayName } from "@/lib/labels";
import { PracticeStatusBadge } from "@/components/practices/practice-status-badge";
import { practiceBillingLabel } from "@/components/practices/helpers";
import { formatDate } from "@/lib/format";

export function PracticeTableRow({
  practice,
  summary,
  onOpen,
}: {
  practice: PracticeListRow;
  summary: PracticeActivitySummary;
  onOpen: () => void;
}) {
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
          to="/pratiche/$caseId"
          params={{ caseId: routeRef(practice) }}
          className="font-medium hover:underline"
        >
          {practice.practice_number}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {practice.principals?.business_name ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {practice.clients ? clientDisplayName(practice.clients) : "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {practice.counterparties ? counterpartyDisplayName(practice.counterparties) : "—"}
      </TableCell>
      <TableCell>
        <PracticeStatusBadge status={practice.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {practiceBillingLabel(summary, false)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(practice.opened_at)}
      </TableCell>
    </TableRow>
  );
}
