import { type PrincipalListRow } from "@/components/principals/types";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { PrincipalStatusBadge } from "@/components/principals/principal-status-badge";
import { economicRulesLabel } from "@/components/principals/helpers";

export function PrincipalTableRow({
  principal,
  onOpen,
}: {
  principal: PrincipalListRow;
  onOpen: () => void;
}) {
  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`Apri committente ${principal.business_name}`}
      onClick={(event) => handleClickableTableRowClick(event, onOpen)}
      onKeyDown={(event) => handleClickableTableRowKeyDown(event, onOpen)}
    >
      <TableCell>
        <Link
          to="/committenti/$principalId"
          params={{ principalId: routeRef(principal) }}
          className="font-medium hover:underline"
        >
          {principal.business_name}
        </Link>
      </TableCell>
      <TableCell>
        <PrincipalStatusBadge archived={!!principal.archived_at} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {economicRulesLabel(principal)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {principal.vat_number || principal.tax_code || "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{principal.email ?? "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {principal.address_city ?? "—"}
      </TableCell>
    </TableRow>
  );
}
