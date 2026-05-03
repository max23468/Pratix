import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { PrincipalForm } from "@/components/principal-form";

export const Route = createFileRoute("/committenti/nuovo")({
  head: () => ({
    meta: [
      { title: "Nuovo committente · Pratix" },
      { name: "description", content: "Aggiungi un nuovo committente." },
      { property: "og:title", content: "Nuovo committente · Pratix" },
      { property: "og:description", content: "Aggiungi un nuovo committente." },
    ],
  }),
  component: () => (
    <AppLayout>
      <NewPrincipal />
    </AppLayout>
  ),
});

function NewPrincipal() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Nuovo committente" description="Compila anagrafica e regole economiche." />
      <PrincipalForm
        onSaved={(id) => navigate({ to: "/committenti/$principalId", params: { principalId: id } })}
        onCancel={() => navigate({ to: "/committenti" })}
      />
    </>
  );
}
