import { type ClientListRow } from "@/components/clients/types";
import { TableRow, TableCell } from "@/components/ui/table";
import { ClientiEmptyState } from "@/components/clients/clienti-empty-state";
import { ClientTableRow } from "@/components/clients/client-table-row";
import { routeRef } from "@/lib/public-route-code";

export function ClientiTableBody({
  isLoading,
  rows,
  hasFilters,
  principalNamesByClient,
  onOpen,
}: {
  isLoading: boolean;
  rows: ClientListRow[];
  hasFilters: boolean;
  principalNamesByClient: Record<string, string[]>;
  onOpen: (clientId: string) => void;
}) {
  if (isLoading || rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
          {isLoading ? "Caricamento…" : <ClientiEmptyState hasFilters={hasFilters} />}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((client) => (
    <ClientTableRow
      key={client.id}
      client={client}
      principalNames={principalNamesByClient[client.id]}
      onOpen={() => onOpen(routeRef(client))}
    />
  ));
}
