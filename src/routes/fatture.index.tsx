import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/fatture/")({
  component: () => (
    <AppLayout>
      <PageHeader
        title="Fatture"
        description="Crea e gestisci le tue fatture, comprese quelle elettroniche XML SdI."
        actions={
          <Link to="/fatture/nuova">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nuova fattura
            </Button>
          </Link>
        }
      />
      <ComingSoon
        title="Modulo fatturazione in arrivo"
        description="Stiamo completando il flusso con calcoli automatici (Cassa Forense, IVA, ritenuta, bollo) e generazione PDF e XML FatturaPA."
      />
    </AppLayout>
  ),
});
