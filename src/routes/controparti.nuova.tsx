import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { CounterpartyForm } from "@/components/counterparty-form";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/controparti/nuova")({
  head: () => ({
    meta: [
      { title: "Nuova controparte · Pratix" },
      { name: "description", content: "Aggiungi una nuova controparte." },
      { property: "og:title", content: "Nuova controparte · Pratix" },
      { property: "og:description", content: "Aggiungi una nuova controparte." },
    ],
  }),
  component: () => (
    <AppLayout>
      <NewCounterparty />
    </AppLayout>
  ),
});

function NewCounterparty() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Nuova controparte"
        description="Crea una persona, una società o una controparte composta."
      />
      <CounterpartyForm
        onSaved={(id) =>
          navigate({ to: "/controparti/$counterpartyId", params: { counterpartyId: id } })
        }
        onCancel={() => navigate({ to: "/controparti" })}
      />
    </>
  );
}
