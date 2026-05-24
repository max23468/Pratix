import type { ClientKind, CounterpartyKind } from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PersonOrCompanyFields({
  kind,
  firstName,
  lastName,
  businessName,
  kindLabel,
  includeGroup,
  companyPlaceholder = "Es. Alfa S.r.l.",
  groupPlaceholder = "Es. Debitori collegati",
  onKindChange,
  onFirstNameChange,
  onLastNameChange,
  onBusinessNameChange,
}: {
  kind: ClientKind | CounterpartyKind;
  firstName: string;
  lastName: string;
  businessName: string;
  kindLabel: string;
  includeGroup?: boolean;
  companyPlaceholder?: string;
  groupPlaceholder?: string;
  onKindChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onBusinessNameChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{kindLabel}</Label>
        <Select value={kind} onValueChange={onKindChange}>
          <SelectTrigger aria-label={kindLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Persona fisica</SelectItem>
            <SelectItem value="company">Società</SelectItem>
            {includeGroup ? <SelectItem value="group">Composta</SelectItem> : null}
          </SelectContent>
        </Select>
      </div>
      {kind === "individual" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cognome</Label>
            <Input
              value={lastName}
              onChange={(event) => onLastNameChange(event.target.value)}
              placeholder="Es. Rossi"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={firstName}
              onChange={(event) => onFirstNameChange(event.target.value)}
              placeholder="Es. Anna"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{kind === "group" ? "Nome gruppo" : "Ragione sociale"}</Label>
          <Input
            value={businessName}
            onChange={(event) => onBusinessNameChange(event.target.value)}
            placeholder={kind === "group" ? groupPlaceholder : companyPlaceholder}
          />
        </div>
      )}
    </div>
  );
}
