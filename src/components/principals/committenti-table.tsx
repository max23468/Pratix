import { type TableSort } from "@/lib/table-sorting";
import { type CommittentiSortKey } from "@/components/principals/types";
import { CommittentiTableBody } from "@/components/principals/committenti-table-body";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableBody } from "@/components/ui/table";
import { SortableTableHead } from "@/components/sortable-table-head";

export function CommittentiTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<CommittentiSortKey>;
  onSort: (key: CommittentiSortKey) => void;
} & React.ComponentProps<typeof CommittentiTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              columnKey="business_name"
              label="Ragione sociale"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={onSort} />
            <SortableTableHead
              columnKey="economics"
              label="Regole economiche"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead columnKey="tax" label="CF / P.IVA" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="email" label="Email" sort={sort} onSort={onSort} />
            <SortableTableHead columnKey="city" label="Città" sort={sort} onSort={onSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          <CommittentiTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
}
