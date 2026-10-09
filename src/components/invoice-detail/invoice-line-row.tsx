import { type InvoiceDetailData } from "@/components/invoice-detail/types";
import { TableRow, TableCell } from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/format";
import { invoiceLineKindLabels, type InvoiceLineKind } from "@/lib/invoice-calc";

export function InvoiceLineRow({ line }: { line: InvoiceDetailData["lines"][number] }) {
  return (
    <TableRow>
      <TableCell>{formatDate(line.activity_date)}</TableCell>
      <TableCell>{line.practice_number ? `N. ${line.practice_number}` : "—"}</TableCell>
      <TableCell>{line.client_name || "—"}</TableCell>
      <TableCell>{line.counterparty_name || "—"}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span>{line.description}</span>
          <span className="text-xs text-muted-foreground">
            {invoiceLineKindLabels[line.kind as InvoiceLineKind]}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">{Number(line.quantity)}</TableCell>
      <TableCell className="text-right">{formatCurrency(Number(line.unit_price))}</TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(Number(line.amount))}
      </TableCell>
    </TableRow>
  );
}
