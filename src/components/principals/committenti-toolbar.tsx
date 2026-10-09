import {
  type CommittentiFilters,
  type PrincipalStatusFilter,
  type PrincipalEconomicsFilter,
} from "@/components/principals/types";
import { ListToolbar } from "@/components/list-toolbar";
import { SearchInput } from "@/components/search-input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function CommittentiToolbar({
  filters,
  onChange,
}: {
  filters: CommittentiFilters;
  onChange: (next: CommittentiFilters) => void;
}) {
  const { q, status, economics } = filters;
  return (
    <ListToolbar>
      <SearchInput
        placeholder="Cerca per ragione sociale, CF, P.IVA, email…"
        value={q}
        onChange={(value) => onChange({ q: value, status, economics })}
      />
      <Select
        value={status}
        onValueChange={(value) =>
          onChange({ q, status: value as PrincipalStatusFilter, economics })
        }
      >
        <SelectTrigger aria-label="Filtra committenti per stato" className="lg:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli stati</SelectItem>
          <SelectItem value="active">Attivi</SelectItem>
          <SelectItem value="archived">Archiviati</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={economics}
        onValueChange={(value) =>
          onChange({ q, status, economics: value as PrincipalEconomicsFilter })
        }
      >
        <SelectTrigger aria-label="Filtra committenti per regole economiche" className="lg:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le regole</SelectItem>
          <SelectItem value="fees">Con compensi</SelectItem>
          <SelectItem value="expenses">Con rimborsi</SelectItem>
          <SelectItem value="fees_only">Solo compensi</SelectItem>
          <SelectItem value="expenses_only">Solo rimborsi</SelectItem>
        </SelectContent>
      </Select>
    </ListToolbar>
  );
}
