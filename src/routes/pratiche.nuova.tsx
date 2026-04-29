import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pratiche/nuova")({
  component: () => (
    <AppLayout>
      <PageHeader
        title="Nuova pratica"
        description="Crea una nuova pratica e collegala a un cliente."
        actions={
          <Link to="/pratiche">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1 h-4 w-4" /> Torna all'elenco
            </Button>
          </Link>
        }
      />
      <ComingSoon
        title="Form pratica in arrivo"
        description="Il form di creazione della pratica sarà disponibile nel prossimo aggiornamento."
      />
    </AppLayout>
  ),
});
