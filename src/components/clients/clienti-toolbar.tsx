import {
  type ClientiFilters,
  type PrincipalOption,
  type ClientKindFilter,
} from "@/components/clients/types";
import { ListToolbar } from "@/components/list-toolbar";
import { SearchInput } from "@/components/search-input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { clientKindLabels } from "@/lib/labels";

export function ClientiToolbar({
  filters,
  principals,
  onChange,
}: {
  filters: ClientiFilters;
  principals: PrincipalOption[];
  onChange: (next: ClientiFilters) => void;
}) {
  const { q, kind, principalId } = filters;
  return (
    <ListToolbar>
      <SearchInput
        placeholder="Cerca per nome o committente…"
        value={q}
        onChange={(value) => onChange({ q: value, kind, principalId })}
      />
      <Select
        value={kind}
        onValueChange={(value) => onChange({ q, kind: value as ClientKindFilter, principalId })}
      >
        <SelectTrigger aria-label="Filtra clienti per tipo" className="lg:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i tipi</SelectItem>
          {Object.entries(clientKindLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={principalId}
        onValueChange={(value) => onChange({ q, kind, principalId: value })}
      >
        <SelectTrigger aria-label="Filtra clienti per committente" className="lg:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i committenti</SelectItem>
          {principals.map((principal) => (
            <SelectItem key={principal.id} value={principal.id}>
              {principal.business_name}
              {principal.archived_at ? " (archiviato)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ListToolbar>
  );
}
