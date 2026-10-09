import { TableEmptyState } from "@/components/table-empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function PracticeEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <TableEmptyState
      title={hasFilters ? "Nessuna pratica trovata" : "Nessuna pratica aperta"}
      description={
        hasFilters
          ? "Modifica ricerca, vista o ordinamento per ampliare i risultati."
          : "Crea la prima pratica e collega committente, cliente e controparte."
      }
      action={
        hasFilters ? undefined : (
          <Button size="sm" asChild>
            <Link to="/pratiche/nuova">Nuova pratica</Link>
          </Button>
        )
      }
    />
  );
}
