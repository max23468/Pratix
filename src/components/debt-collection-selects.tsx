import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { clientDisplayName, compareCounterparties, counterpartyDisplayName } from "@/lib/labels";

type CommonSelectProps = {
  id?: string;
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

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
    <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled || isLoading}>
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
      return data ?? [];
    },
  });

  return (
    <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled || isLoading}>
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

export function CounterpartySelect({
  id,
  value,
  onValueChange,
  placeholder = "Seleziona controparte",
  disabled,
}: CommonSelectProps) {
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

  return (
    <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled || isLoading}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={isLoading ? "Caricamento…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {(data ?? []).map((counterparty) => (
          <SelectItem key={counterparty.id} value={counterparty.id}>
            {counterpartyDisplayName(counterparty)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
