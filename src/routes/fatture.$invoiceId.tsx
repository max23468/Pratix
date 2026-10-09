import { createFileRoute, Link } from "@tanstack/react-router";
import { useInvoiceDetailPage } from "@/components/invoice-detail/helpers";
import { AppLayout } from "@/components/app-layout";
import { PageState } from "@/components/page-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { InvoiceLinesCard } from "@/components/invoice-detail/invoice-lines-card";
import { InvoiceTotalsCard } from "@/components/invoice-detail/invoice-totals-card";
import { InvoiceActionsCard } from "@/components/invoice-detail/invoice-actions-card";
import { InvoiceDocumentsCard } from "@/components/invoice-detail/invoice-documents-card";

export const Route = createFileRoute("/fatture/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Fattura · Pratix" },
      { name: "description", content: "Dettaglio fattura, PDF, XML SdI e rendiconti Excel." },
      { property: "og:title", content: "Fattura · Pratix" },
      {
        property: "og:description",
        content: "Dettaglio fattura, PDF, XML SdI e rendiconti Excel.",
      },
    ],
  }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const { data, isLoading, downloadingExportId, handleDownloadPdf, downloadExport, ...mutations } =
    useInvoiceDetailPage(invoiceId);

  if (isLoading || !data) {
    return (
      <AppLayout>
        <PageState variant="loading" title="Caricamento fattura…" />
      </AppLayout>
    );
  }

  const billedName = data.principal?.business_name ?? data.client?.business_name ?? "—";

  return (
    <AppLayout>
      <PageHeader
        title={`Fattura ${data.invoice.number}/${data.invoice.year}`}
        description={`Committente: ${billedName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/fatture">
                <ArrowLeft className="mr-2 size-4" /> Torna alle fatture
              </Link>
            </Button>
            <Button asChild>
              <Link to="/fatture/nuova">
                <Plus className="mr-2 size-4" /> Nuova fattura
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <InvoiceLinesCard lines={data.lines} />

        <div className="space-y-4">
          <InvoiceTotalsCard invoice={data.invoice} />
          <InvoiceActionsCard invoice={data.invoice} mutations={mutations} />
          <InvoiceDocumentsCard
            exports={data.exports}
            downloadingExportId={downloadingExportId}
            downloadXmlMutation={mutations.downloadXmlMutation}
            onDownloadPdf={handleDownloadPdf}
            onDownloadExport={downloadExport}
          />
        </div>
      </div>
    </AppLayout>
  );
}
