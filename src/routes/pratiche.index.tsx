import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pratiche/")({
  component: () => (
    <AppLayout>
      <PageHeader
        title="Pratiche"
        description="Gestisci le pratiche del tuo studio: stato, scadenze, tariffe e note."
        actions={
          <Link to="/pratiche/nuova">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nuova pratica
            </Button>
          </Link>
        }
      />
      <ComingSoon
        title="Modulo pratiche in arrivo"
        description="Stiamo completando l'elenco pratiche con filtri per stato, materia e cliente. Sarà disponibile a breve."
      />
    </AppLayout>
  ),
});
