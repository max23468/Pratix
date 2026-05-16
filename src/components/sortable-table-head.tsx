import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortDirection, TableSort } from "@/lib/table-sorting";
import { cn } from "@/lib/utils";

type SortableTableHeadProps<Key extends string> = {
  columnKey: Key;
  label: string;
  sort: TableSort<Key>;
  onSort: (columnKey: Key) => void;
  className?: string;
  align?: "left" | "right";
};

export function SortableTableHead<Key extends string>({
  columnKey,
  label,
  sort,
  onSort,
  className,
  align = "left",
}: SortableTableHeadProps<Key>) {
  const isActive = sort.key === columnKey;
  const ariaSort = isActive ? ariaSortValue(sort.direction) : "none";
  const Icon = isActive ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <TableHead className={className} aria-sort={ariaSort}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 rounded-sm py-1 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "justify-end text-right",
        )}
        onClick={() => onSort(columnKey)}
        aria-label={`Ordina per ${label}`}
        title={`Ordina per ${label}`}
      >
        <span>{label}</span>
        <Icon className={cn("size-3.5", isActive && "text-foreground")} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function ariaSortValue(direction: SortDirection) {
  return direction === "asc" ? "ascending" : "descending";
}
