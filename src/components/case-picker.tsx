import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  activityCaseLabel,
  activityCasePartiesLabel,
  type CaseActivityContext,
} from "@/lib/case-activities";
import { practiceDisplayName } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type CaseOption = CaseActivityContext & { practice_number: number };

const displayLabel = (option: CaseOption) => practiceDisplayName(option);
const searchValue = (option: CaseOption) =>
  [displayLabel(option), activityCaseLabel(option), option.principals?.business_name]
    .filter((value): value is string => Boolean(value))
    .join(" ");

export function CasePicker({
  id,
  options,
  selectedCaseId,
  onSelect,
}: {
  id: string;
  options: CaseOption[];
  selectedCaseId: string;
  onSelect: (caseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.id === selectedCaseId);
  const listId = `${id}-list`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-label="Seleziona pratica"
          className="justify-between"
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !selectedOption && "text-muted-foreground",
            )}
          >
            {selectedOption ? displayLabel(selectedOption) : "Seleziona pratica"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[60] max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
      >
        <Command>
          <CommandInput placeholder="Cerca pratica…" />
          <CommandList
            id={listId}
            className="max-h-[min(20rem,var(--radix-popover-content-available-height))]"
          >
            <CommandEmpty>Nessuna pratica trovata.</CommandEmpty>
            {options.map((option) => {
              const isSelected = option.id === selectedCaseId;
              return (
                <CommandItem
                  key={option.id}
                  value={searchValue(option)}
                  onSelect={() => {
                    onSelect(option.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{displayLabel(option)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {activityCasePartiesLabel(option)}
                    </span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
