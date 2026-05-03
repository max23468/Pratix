import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { PriceBookForm } from "@/components/price-book-form";

export const Route = createFileRoute("/prezzi/nuovo")({
  head: () => ({
    meta: [
      { title: "Nuovi prezzi · Pratix" },
      { name: "description", content: "Crea prezzi annuali per un committente." },
      { property: "og:title", content: "Nuovi prezzi · Pratix" },
      { property: "og:description", content: "Crea prezzi annuali per un committente." },
    ],
  }),
  component: () => (
    <AppLayout>
      <NewPriceBook />
    </AppLayout>
  ),
});

function NewPriceBook() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Nuovi prezzi"
        description="Crea un set annuale partendo dal template comune o dall'anno precedente."
      />
      <PriceBookForm
        onSaved={(id) => navigate({ to: "/prezzi/$priceBookId", params: { priceBookId: id } })}
        onCancel={() => navigate({ to: "/prezzi" })}
      />
    </>
  );
}
