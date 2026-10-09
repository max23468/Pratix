import { type InvoiceRecord } from "@/components/invoice-detail/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { invoiceStatusVariant, invoiceStatusLabels } from "@/lib/labels";
import { SummaryRow } from "@/components/invoice-detail/summary-row";
import { formatDate, formatCurrency } from "@/lib/format";

export function InvoiceTotalsCard({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Totali</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant={invoiceStatusVariant[invoice.status] ?? "outline"}>
          {invoiceStatusLabels[invoice.status] ?? invoice.status}
        </Badge>
        <SummaryRow label="Data" value={formatDate(invoice.issue_date)} />
        <SummaryRow label="Compensi" value={formatCurrency(Number(invoice.taxable_fees))} />
        {Number(invoice.general_expenses_amount) > 0 && (
          <SummaryRow
            label="Spese generali"
            value={formatCurrency(Number(invoice.general_expenses_amount))}
          />
        )}
        <SummaryRow label="Cassa" value={formatCurrency(Number(invoice.cassa_amount))} />
        {Number(invoice.vat_amount) > 0 && (
          <SummaryRow label="IVA" value={formatCurrency(Number(invoice.vat_amount))} />
        )}
        <SummaryRow
          label="Rimborsi Art. 15"
          value={formatCurrency(Number(invoice.art15_expenses))}
        />
        <SummaryRow label="Totale" value={formatCurrency(Number(invoice.total_amount))} strong />
        <SummaryRow label="Netto" value={formatCurrency(Number(invoice.net_to_pay))} strong />
      </CardContent>
    </Card>
  );
}
