import { type TableSort } from "@/lib/table-sorting";
import { type ClientiSortKey } from "@/components/clients/types";
import { ClientiTableBody } from "@/components/clients/clienti-table-body";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableBody } from "@/components/ui/table";
import { SortableTableHead } from "@/components/sortable-table-head";

export function ClientiTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<ClientiSortKey>;
  onSort: (key: ClientiSortKey) => void;
} & React.ComponentProps<typeof ClientiTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead columnKey="name" label="Nome" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="kind" label="Tipo" sort={sort} onSort={onSort} />
            <SortableTableHead
              columnKey="principals"
              label="Committenti"
              sort={sort}
              onSort={onSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          <ClientiTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
}
