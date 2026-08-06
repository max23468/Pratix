import { Link } from "@tanstack/react-router";
import { mobileListCardLinkClassName } from "@/components/mobile-list-card";
import { MobileListCardDetails } from "@/components/mobile-list-card-details";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { SortableTableHead } from "@/components/sortable-table-head";
import { TableEmptyState } from "@/components/table-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoicePeriodLabel } from "@/lib/invoice-period";
import {
  clientDisplayName,
  invoiceStatusLabels,
  invoiceStatusVariant,
  type ClientDisplayData,
} from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import type { TableSort } from "@/lib/table-sorting";
import type { FattureSortKey, InvoiceListRow } from "@/routes/fatture.index";

type Props = {
  rows: InvoiceListRow[];
  isLoading: boolean;
  hasInvoiceFilters: boolean;
  today: string;
  sort: TableSort<FattureSortKey>;
  onSort: (columnKey: FattureSortKey) => void;
  onOpen: (invoiceRef: string) => void;
};

export function InvoiceListResults({
  rows,
  isLoading,
  hasInvoiceFilters,
  today,
  sort,
  onSort,
  onOpen,
}: Props) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>
        ) : rows.length === 0 ? (
          <Card className="p-4">
            <TableEmptyState
              title={hasInvoiceFilters ? "Nessuna fattura trovata" : "Nessuna fattura"}
              description={
                hasInvoiceFilters
                  ? "Modifica ricerca, stato, anno o periodo per ampliare i risultati."
                  : "Crea una fattura partendo dalle attività da fatturare."
              }
              action={
                !hasInvoiceFilters ? (
                  <Button size="sm" asChild>
                    <Link to="/fatture/nuova">Nuova fattura</Link>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          rows.map((i) => {
            const isOverdue = i.status === "issued" && i.due_date && i.due_date < today;
            const billedName =
              i.principal?.business_name || clientDisplayName(i.client as ClientDisplayData);
            return (
              <Link
                key={i.id}
                to="/fatture/$invoiceId"
                params={{ invoiceId: routeRef(i) }}
                className={mobileListCardLinkClassName}
              >
                <MobileListCardHeader
                  title={`Fattura ${i.number}/${i.year}`}
                  subtitle={billedName}
                  badge={
                    <Badge
                      variant={
                        isOverdue ? "destructive" : invoiceStatusVariant[i.status] || "outline"
                      }
                    >
                      {isOverdue ? "Scaduta" : invoiceStatusLabels[i.status] || i.status}
                    </Badge>
                  }
                />
                <MobileListCardDetails
                  rows={[
                    { label: "Data", value: formatDate(i.issue_date) },
                    { label: "Periodo", value: invoicePeriodLabel(i.billing_run) },
                    {
                      label: "Scadenza",
                      value: formatDate(i.due_date),
                      valueClassName: isOverdue ? "font-medium text-destructive" : undefined,
                    },
                    { label: "Totale", value: formatCurrency(Number(i.total_amount)) },
                    {
                      label: "Netto",
                      value: formatCurrency(Number(i.net_to_pay)),
                      valueClassName: "font-medium text-foreground",
                    },
                  ]}
                />
              </Link>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead columnKey="number" label="Numero" sort={sort} onSort={onSort} />
              <SortableTableHead columnKey="issue_date" label="Data" sort={sort} onSort={onSort} />
              <SortableTableHead columnKey="period" label="Periodo" sort={sort} onSort={onSort} />
              <SortableTableHead
                columnKey="principal"
                label="Committente"
                sort={sort}
                onSort={onSort}
              />
              <SortableTableHead
                columnKey="due_date"
                label="Scadenza"
                sort={sort}
                onSort={onSort}
              />
              <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={onSort} />
              <SortableTableHead
                columnKey="total_amount"
                label="Totale"
                sort={sort}
                onSort={onSort}
                align="right"
                className="text-right"
              />
              <SortableTableHead
                columnKey="net_to_pay"
                label="Netto"
                sort={sort}
                onSort={onSort}
                align="right"
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  <TableEmptyState
                    title={hasInvoiceFilters ? "Nessuna fattura trovata" : "Nessuna fattura"}
                    description={
                      hasInvoiceFilters
                        ? "Modifica ricerca, stato, anno o periodo per ampliare i risultati."
                        : "Crea una fattura partendo dalle attività da fatturare."
                    }
                    action={
                      !hasInvoiceFilters ? (
                        <Button size="sm" asChild>
                          <Link to="/fatture/nuova">Nuova fattura</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((i) => {
              const isOverdue = i.status === "issued" && i.due_date && i.due_date < today;
              return (
                <TableRow
                  key={i.id}
                  className="cursor-pointer"
                  role="link"
                  tabIndex={0}
                  aria-label={`Apri fattura ${i.number}/${i.year}`}
                  onClick={(event) =>
                    handleClickableTableRowClick(event, () => onOpen(routeRef(i)))
                  }
                  onKeyDown={(event) =>
                    handleClickableTableRowKeyDown(event, () => onOpen(routeRef(i)))
                  }
                >
                  <TableCell>
                    <Link
                      to="/fatture/$invoiceId"
                      params={{ invoiceId: routeRef(i) }}
                      className="font-medium hover:underline"
                    >
                      {i.number}/{i.year}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(i.issue_date)}</TableCell>
                  <TableCell>{invoicePeriodLabel(i.billing_run)}</TableCell>
                  <TableCell>
                    {i.principal?.business_name || clientDisplayName(i.client as ClientDisplayData)}
                  </TableCell>
                  <TableCell className={isOverdue ? "font-medium text-destructive" : ""}>
                    {formatDate(i.due_date)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        isOverdue ? "destructive" : invoiceStatusVariant[i.status] || "outline"
                      }
                    >
                      {isOverdue ? "Scaduta" : invoiceStatusLabels[i.status] || i.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(i.total_amount))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(i.net_to_pay))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
