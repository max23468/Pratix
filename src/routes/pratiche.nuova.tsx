import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { CaseForm } from "@/components/case-form";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pratiche/nuova")({
  head: () => ({
    meta: [
      { title: "Nuova pratica — Pratix" },
      { name: "description", content: "Apri una nuova pratica." },
      { property: "og:title", content: "Nuova pratica — Pratix" },
      { property: "og:description", content: "Apri una nuova pratica." },
    ],
  }),
  component: () => (
    <AppLayout>
      <NewCase />
    </AppLayout>
  ),
});

function NewCase() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Nuova pratica"
        description="Compila i dati della pratica e collegala a un cliente."
        actions={
          <Link to="/pratiche">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1 h-4 w-4" /> Indietro
            </Button>
          </Link>
        }
      />
      <CaseForm
        onSaved={(id) => navigate({ to: "/pratiche/$caseId", params: { caseId: id } })}
        onCancel={() => navigate({ to: "/pratiche" })}
      />
    </>
  );
}
