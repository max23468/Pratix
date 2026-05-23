import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { compareCounterparties, counterpartyDisplayName } from "@/lib/labels";
import {
  emitSelectedValue,
  emptyCounterpartyOptions,
  type CommonSelectProps,
  type CounterpartyOption,
} from "@/components/debt-collection-selects-common";

export function CounterpartySelect({
  id,
  value,
  onValueChange,
  placeholder = "Seleziona controparte",
  disabled,
  additionalOptions = emptyCounterpartyOptions,
}: CommonSelectProps & { additionalOptions?: CounterpartyOption[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["counterparties", "selector"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, kind, first_name, last_name, business_name");
      if (error) throw error;
      return (data ?? []).slice().sort(compareCounterparties);
    },
  });
  const options = useMemo(() => {
    const byId = new Map<string, CounterpartyOption>();
    (data ?? []).forEach((counterparty) => byId.set(counterparty.id, counterparty));
    additionalOptions.forEach((counterparty) => byId.set(counterparty.id, counterparty));
    return Array.from(byId.values()).sort(compareCounterparties);
  }, [additionalOptions, data]);

  return (
    <Select
      value={value ?? ""}
      onValueChange={emitSelectedValue(onValueChange)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={isLoading ? "Caricamento…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((counterparty) => (
          <SelectItem key={counterparty.id} value={counterparty.id}>
            {counterpartyDisplayName(counterparty)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
