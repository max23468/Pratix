import { TableEmptyState } from "@/components/table-empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function ContropartiEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <TableEmptyState
      title={hasFilters ? "Nessuna controparte trovata" : "Nessuna controparte"}
      description={
        hasFilters
          ? "Modifica ricerca o filtro per ampliare i risultati."
          : "Aggiungi la prima controparte per collegarla alle pratiche."
      }
      action={
        hasFilters ? undefined : (
          <Button size="sm" asChild>
            <Link to="/controparti/nuova">Nuova controparte</Link>
          </Button>
        )
      }
    />
  );
}
