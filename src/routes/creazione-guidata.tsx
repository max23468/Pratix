import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { GuidedCreationWizard } from "@/components/guided-creation/guided-creation-wizard";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/creazione-guidata")({
  head: () => ({
    meta: [
      { title: "Creazione guidata · Pratix" },
      {
        name: "description",
        content: "Crea pratiche da archivio cartaceo con procedura manuale, anteprima e conferma.",
      },
      { property: "og:title", content: "Creazione guidata · Pratix" },
      {
        property: "og:description",
        content: "Crea pratiche da archivio cartaceo con procedura manuale, anteprima e conferma.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <GuidedCreation />
    </AppLayout>
  ),
});

function GuidedCreation() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Creazione guidata"
        description="Trascrivi una pratica da archivio cartaceo con controllo finale prima della conferma."
        actions={
          <Link to="/pratiche">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1 size-4" /> Pratiche
            </Button>
          </Link>
        }
      />

      <GuidedCreationWizard
        onCreated={(caseId) => navigate({ to: "/pratiche/$caseId", params: { caseId } })}
      />
    </>
  );
}
