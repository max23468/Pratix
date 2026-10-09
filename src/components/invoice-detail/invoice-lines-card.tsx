import { type InvoiceDetailData } from "@/components/invoice-detail/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { InvoiceLineRow } from "@/components/invoice-detail/invoice-line-row";

export function InvoiceLinesCard({ lines }: { lines: InvoiceDetailData["lines"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Righe fattura</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Pratica</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Controparte</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-right">Q.tà</TableHead>
              <TableHead className="text-right">Prezzo</TableHead>
              <TableHead className="text-right">Totale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <InvoiceLineRow key={line.id} line={line} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
