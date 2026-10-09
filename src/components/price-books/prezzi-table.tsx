import { type TableSort } from "@/lib/table-sorting";
import { type PrezziSortKey } from "@/components/price-books/types";
import { PrezziTableBody } from "@/components/price-books/prezzi-table-body";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableBody } from "@/components/ui/table";
import { SortableTableHead } from "@/components/sortable-table-head";

export function PrezziTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<PrezziSortKey>;
  onSort: (key: PrezziSortKey) => void;
} & React.ComponentProps<typeof PrezziTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              columnKey="principal"
              label="Committente"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead columnKey="year" label="Anno" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="rules" label="Regole" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="items" label="Voci" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="validity" label="Validità" sort={sort} onSort={onSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          <PrezziTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
}
