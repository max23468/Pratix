import { type PriceBookListRow } from "@/components/price-books/types";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { Badge } from "@/components/ui/badge";
import { priceBookStatusVariant, priceBookStatusLabels } from "@/lib/labels";
import { rulesLabel } from "@/components/price-books/helpers";

export function PriceBookTableRow({
  book,
  counts,
  principalName,
  onOpen,
}: {
  book: PriceBookListRow;
  counts: { fees: number; expenses: number; enabled: number };
  principalName: string;
  onOpen: () => void;
}) {
  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`Apri prezzi ${principalName} ${book.year}`}
      onClick={(event) => handleClickableTableRowClick(event, onOpen)}
      onKeyDown={(event) => handleClickableTableRowKeyDown(event, onOpen)}
    >
      <TableCell>
        <Link
          to="/prezzi/$priceBookId"
          params={{ priceBookId: routeRef(book) }}
          className="font-medium hover:underline"
        >
          {principalName}
        </Link>
      </TableCell>
      <TableCell>{book.year}</TableCell>
      <TableCell>
        <Badge variant={priceBookStatusVariant[book.status]}>
          {priceBookStatusLabels[book.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{rulesLabel(book)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {counts.fees} compensi, {counts.expenses} rimborsi
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {book.valid_from} → {book.valid_to ?? "senza fine"}
      </TableCell>
    </TableRow>
  );
}
