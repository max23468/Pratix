import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pratiche/$caseId")({
  component: CaseDetail,
});

function CaseDetail() {
  const { caseId } = Route.useParams();
  return (
    <AppLayout>
      <PageHeader
        title="Dettaglio pratica"
        description={`ID pratica: ${caseId}`}
        actions={
          <Link to="/pratiche">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1 h-4 w-4" /> Torna all'elenco
            </Button>
          </Link>
        }
      />
      <ComingSoon
        title="Dettaglio pratica in arrivo"
        description="Qui troverai stato, scadenze, rimborsi spese e fatturazione collegati a questa pratica."
      />
    </AppLayout>
  );
}
