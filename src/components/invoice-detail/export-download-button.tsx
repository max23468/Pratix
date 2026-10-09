import { type InvoiceDetailData } from "@/components/invoice-detail/types";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";

export function ExportDownloadButton({
  item,
  isDownloading,
  onDownload,
}: {
  item: InvoiceDetailData["exports"][number];
  isDownloading: boolean;
  onDownload: (exportId: string, kind: "fees" | "expenses") => Promise<void>;
}) {
  const kind = item.kind === "fees" || item.kind === "expenses" ? item.kind : "fees";
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full min-w-0 justify-start overflow-hidden"
      disabled={isDownloading}
      onClick={() => void onDownload(item.id, kind)}
    >
      <FileSpreadsheet className="mr-2 size-4 shrink-0" />
      <span className="min-w-0 truncate text-left">
        {isDownloading ? "Preparazione download…" : item.file_name}
      </span>
    </Button>
  );
}
