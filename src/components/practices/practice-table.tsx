import { type TableSort } from "@/lib/table-sorting";
import { type PraticheSortKey } from "@/components/practices/types";
import { PracticeTableBody } from "@/components/practices/practice-table-body";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableBody } from "@/components/ui/table";
import { SortableTableHead } from "@/components/sortable-table-head";

export function PracticeTable({
  sort,
  onSort,
  ...bodyProps
}: {
  sort: TableSort<PraticheSortKey>;
  onSort: (columnKey: PraticheSortKey) => void;
} & React.ComponentProps<typeof PracticeTableBody>) {
  return (
    <Card className="hidden min-w-0 md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              columnKey="practice_number"
              label="Pratica"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead
              columnKey="principal"
              label="Committente"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead columnKey="client" label="Cliente" sort={sort} onSort={onSort} />
            <SortableTableHead
              columnKey="counterparty"
              label="Controparte"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead columnKey="status" label="Stato" sort={sort} onSort={onSort} />
            <SortableTableHead
              columnKey="billing"
              label="Fatturazione"
              sort={sort}
              onSort={onSort}
            />
            <SortableTableHead
              columnKey="opened_at"
              label="Aperta il"
              sort={sort}
              onSort={onSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          <PracticeTableBody {...bodyProps} />
        </TableBody>
      </Table>
    </Card>
  );
}
