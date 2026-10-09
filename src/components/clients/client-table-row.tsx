import { type ClientListRow } from "@/components/clients/types";
import { clientDisplayName, clientKindLabels } from "@/lib/labels";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import { Badge } from "@/components/ui/badge";

export function ClientTableRow({
  client,
  principalNames,
  onOpen,
}: {
  client: ClientListRow;
  principalNames?: string[];
  onOpen: () => void;
}) {
  const displayName = clientDisplayName(client);
  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`Apri cliente ${displayName}`}
      onClick={(event) => handleClickableTableRowClick(event, onOpen)}
      onKeyDown={(event) => handleClickableTableRowKeyDown(event, onOpen)}
    >
      <TableCell>
        <span className="font-medium">{displayName}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{clientKindLabels[client.kind] ?? client.kind}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {principalNames?.join(", ") || "—"}
      </TableCell>
    </TableRow>
  );
}
