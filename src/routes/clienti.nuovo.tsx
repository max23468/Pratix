import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { ClientForm } from "@/components/client-form";

export const Route = createFileRoute("/clienti/nuovo")({
  head: () => ({
    meta: [
      { title: "Nuovo cliente — Pratix" },
      { name: "description", content: "Aggiungi un nuovo cliente al tuo studio." },
      { property: "og:title", content: "Nuovo cliente — Pratix" },
      { property: "og:description", content: "Aggiungi un nuovo cliente al tuo studio." },
    ],
  }),
  component: () => (
    <AppLayout>
      <NewClient />
    </AppLayout>
  ),
});

function NewClient() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Nuovo cliente" description="Compila i dati anagrafici del cliente." />
      <ClientForm
        onSaved={(id) => navigate({ to: "/clienti/$clientId", params: { clientId: id } })}
        onCancel={() => navigate({ to: "/clienti" })}
      />
    </>
  );
}
