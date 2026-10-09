import { TableEmptyState } from "@/components/table-empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function CommittentiEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <TableEmptyState
      title={hasFilters ? "Nessun committente trovato" : "Nessun committente"}
      description={
        hasFilters
          ? "Modifica ricerca o filtri per ampliare i risultati."
          : "Aggiungi il primo committente per configurare prezzi, clienti e pratiche."
      }
      action={
        hasFilters ? undefined : (
          <Button size="sm" asChild>
            <Link to="/committenti/nuovo">Nuovo committente</Link>
          </Button>
        )
      }
    />
  );
}
