import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/fatture/nuova")({
  component: () => (
    <AppLayout>
      <PageHeader
        title="Nuova fattura"
        description="Compila i dati per generare una nuova fattura."
        actions={
          <Link to="/fatture">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1 h-4 w-4" /> Torna all'elenco
            </Button>
          </Link>
        }
      />
      <ComingSoon
        title="Form fattura in arrivo"
        description="Il form di creazione fattura, con righe, calcoli automatici ed export XML, sarà disponibile a breve."
      />
    </AppLayout>
  ),
});
