import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  emitSelectedValue,
  type CommonSelectProps,
} from "@/components/debt-collection-selects-common";
export { ClientSelect } from "@/components/client-select";
export { CounterpartySelect } from "@/components/counterparty-select";

export function PrincipalSelect({
  id,
  value,
  onValueChange,
  placeholder = "Seleziona committente",
  disabled,
}: CommonSelectProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["principals", "selector"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name, archived_at")
        .is("archived_at", null)
        .order("business_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

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
        {(data ?? []).map((principal) => (
          <SelectItem key={principal.id} value={principal.id}>
            {principal.business_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
