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
import {
  clientDisplayName,
  compareClients,
  compareCounterparties,
  counterpartyDisplayName,
} from "@/lib/labels";

type CommonSelectProps = {
  id?: string;
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type CounterpartyOption = {
  id: string;
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

const emptyCounterpartyOptions: CounterpartyOption[] = [];

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
      return (data ?? []).slice().sort(compareClients);
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
    <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled || isLoading}>
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
