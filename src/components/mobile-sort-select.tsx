import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MobileSortSelectProps<TSortKey extends string> = {
  columns: readonly { key: TSortKey; label: string }[];
  sort: { key: TSortKey; direction: "asc" | "desc" };
  onSort: (sort: { key: TSortKey; direction: "asc" | "desc" }) => void;
};

export function MobileSortSelect<TSortKey extends string>({
  columns,
  sort,
  onSort,
}: MobileSortSelectProps<TSortKey>) {
  return (
    <Select
      value={`${sort.key}:${sort.direction}`}
      onValueChange={(value) => {
        const [key, direction] = value.split(":");
        onSort({ key: key as TSortKey, direction: direction as "asc" | "desc" });
      }}
    >
      <SelectTrigger aria-label="Ordina elenco" className="w-full md:hidden">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {columns.map((column) => (
          <SelectItem key={`${column.key}-asc`} value={`${column.key}:asc`}>
            {column.label} crescente
          </SelectItem>
        ))}
        {columns.map((column) => (
          <SelectItem key={`${column.key}-desc`} value={`${column.key}:desc`}>
            {column.label} decrescente
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
