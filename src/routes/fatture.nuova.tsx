import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/invoice-form";

export const Route = createFileRoute("/fatture/nuova")({
  head: () => ({
    meta: [
      { title: "Nuova fattura · Pratix" },
      { name: "description", content: "Genera una fattura da attività per committente e periodo." },
      { property: "og:title", content: "Nuova fattura · Pratix" },
      {
        property: "og:description",
        content: "Genera una fattura da attività per committente e periodo.",
      },
    ],
  }),
  component: NewInvoicePage,
});

function NewInvoicePage() {
  return (
    <AppLayout>
      <PageHeader
        title="Nuova fattura"
        description="Estrai attività, decidi inclusioni e rinvii, poi genera fattura e rendiconti Excel."
        actions={
          <Button asChild variant="outline">
            <Link to="/fatture">
              <ArrowLeft className="mr-2 size-4" /> Torna alle fatture
            </Link>
          </Button>
        }
      />
      <InvoiceForm />
    </AppLayout>
  );
}
