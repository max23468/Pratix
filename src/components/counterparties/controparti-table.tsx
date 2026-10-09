import { type TableSort } from "@/lib/table-sorting";
import { type ContropartiSortKey } from "@/components/counterparties/types";
import { ContropartiTableBody } from "@/components/counterparties/controparti-table-body";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableBody } from "@/components/ui/table";
import { SortableTableHead } from "@/components/sortable-table-head";

export function ContropartiTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<ContropartiSortKey>;
  onSort: (key: ContropartiSortKey) => void;
} & React.ComponentProps<typeof ContropartiTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead columnKey="name" label="Nome" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="kind" label="Tipo" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="subjects" label="Soggetti" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="notes" label="Note" sort={sort} onSort={onSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          <ContropartiTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
}
