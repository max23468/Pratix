import { TableEmptyState } from "@/components/table-empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function PrezziEmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <TableEmptyState
      title={hasSearch ? "Nessun prezzo trovato" : "Nessun prezzo"}
      description={
        hasSearch
          ? "Modifica ricerca o ordinamento per ampliare i risultati."
          : "Crea il primo set annuale per un committente."
      }
      action={
        hasSearch ? undefined : (
          <Button size="sm" asChild>
            <Link to="/prezzi/nuovo">Nuovi prezzi</Link>
          </Button>
        )
      }
    />
  );
}
