import { type ClientListRow } from "@/components/clients/types";
import { Card } from "@/components/ui/card";
import { ClientiEmptyState } from "@/components/clients/clienti-empty-state";
import { ClientMobileCard } from "@/components/clients/client-mobile-card";

export function ClientiMobileList({
  isLoading,
  rows,
  hasFilters,
  principalNamesByClient,
}: {
  isLoading: boolean;
  rows: ClientListRow[];
  hasFilters: boolean;
  principalNamesByClient: Record<string, string[]>;
}) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <ClientiEmptyState hasFilters={hasFilters} />
      </Card>
    );
  }
  return rows.map((client) => (
    <ClientMobileCard
      key={client.id}
      client={client}
      principalNames={principalNamesByClient[client.id]}
    />
  ));
}
