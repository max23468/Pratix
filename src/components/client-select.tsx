import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { clientDisplayName, compareClients } from "@/lib/labels";
import {
  emitSelectedValue,
  type CommonSelectProps,
} from "@/components/debt-collection-selects-common";

export function ClientSelect({
  id,
  value,
  onValueChange,
  placeholder = "Seleziona cliente",
  disabled,
}: CommonSelectProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["clients", "selector"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, kind, first_name, last_name, business_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).slice().sort(compareClients);
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
        {(data ?? []).map((client) => (
          <SelectItem key={client.id} value={client.id}>
            {clientDisplayName(client)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
