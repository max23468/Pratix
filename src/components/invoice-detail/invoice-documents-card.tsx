import { type InvoiceDetailData, type ActionMutation } from "@/components/invoice-detail/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FileDown } from "lucide-react";
import { ExportDownloadButton } from "@/components/invoice-detail/export-download-button";

export function InvoiceDocumentsCard({
  exports,
  downloadingExportId,
  downloadXmlMutation,
  onDownloadPdf,
  onDownloadExport,
}: {
  exports: InvoiceDetailData["exports"];
  downloadingExportId: string | null;
  downloadXmlMutation: ActionMutation;
  onDownloadPdf: () => void;
  onDownloadExport: (exportId: string, kind: "fees" | "expenses") => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documenti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <Button variant="outline" className="w-full justify-start" onClick={onDownloadPdf}>
            <FileText className="mr-2 size-4" /> PDF
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => downloadXmlMutation.mutate()}
            disabled={downloadXmlMutation.isPending}
          >
            <FileDown className="mr-2 size-4" />
            {downloadXmlMutation.isPending ? "Generazione…" : "XML SdI"}
          </Button>
        </div>
        {exports.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun rendiconto salvato.</p>
        )}
        {exports.map((item) => (
          <ExportDownloadButton
            key={item.id}
            item={item}
            isDownloading={downloadingExportId === item.id}
            onDownload={onDownloadExport}
          />
        ))}
      </CardContent>
    </Card>
  );
}
