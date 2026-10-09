import {
  type ContropartiFilters,
  type CounterpartyKindFilter,
} from "@/components/counterparties/types";
import { ListToolbar } from "@/components/list-toolbar";
import { SearchInput } from "@/components/search-input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { counterpartyKindLabels } from "@/lib/labels";

export function ContropartiToolbar({
  filters,
  onChange,
}: {
  filters: ContropartiFilters;
  onChange: (next: ContropartiFilters) => void;
}) {
  const { q, kind } = filters;
  return (
    <ListToolbar className="sm:flex-row sm:items-center">
      <SearchInput
        placeholder="Cerca per nome, ragione sociale o note…"
        value={q}
        onChange={(value) => onChange({ q: value, kind })}
      />
      <Select
        value={kind}
        onValueChange={(value) => onChange({ q, kind: value as CounterpartyKindFilter })}
      >
        <SelectTrigger aria-label="Filtra controparti per tipo" className="sm:w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i tipi</SelectItem>
          {Object.entries(counterpartyKindLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ListToolbar>
  );
}
