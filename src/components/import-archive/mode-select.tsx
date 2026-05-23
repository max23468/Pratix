import type { ExistingMode } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ModeSelect({
  id,
  value,
  onValueChange,
  existingLabel,
  newLabel,
}: {
  id: string;
  value: ExistingMode;
  onValueChange: (value: ExistingMode) => void;
  existingLabel: string;
  newLabel: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as ExistingMode)}>
      <SelectTrigger
        id={id}
        aria-label={`Scegli tra ${existingLabel.toLowerCase()} e ${newLabel.toLowerCase()}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="existing">{existingLabel}</SelectItem>
        <SelectItem value="new">{newLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}
