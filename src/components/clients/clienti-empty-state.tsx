import { TableEmptyState } from "@/components/table-empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function ClientiEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <TableEmptyState
      title={hasFilters ? "Nessun cliente trovato" : "Nessun cliente"}
      description={
        hasFilters
          ? "Modifica ricerca o filtri per ampliare i risultati."
          : "Aggiungi il primo cliente e collegalo ai committenti interessati."
      }
      action={
        hasFilters ? undefined : (
          <Button size="sm" asChild>
            <Link to="/clienti/nuovo">Nuovo cliente</Link>
          </Button>
        )
      }
    />
  );
}
