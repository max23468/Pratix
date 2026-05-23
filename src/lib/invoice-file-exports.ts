import { strToU8, zipSync } from "fflate";
import type { InvoicePdfData } from "@/lib/invoice-pdf";
import { safeArchiveSegment } from "@/lib/file-downloads";
export { downloadBytes, safeArchiveSegment } from "@/lib/file-downloads";

export function invoicePdfFileName(invoice: InvoicePdfData["invoice"]) {
  return `Fattura_${safeArchiveSegment(invoice.year)}_${safeArchiveSegment(invoice.number)}.pdf`;
}

export async function invoicePdfBytes(data: InvoicePdfData) {
  const { generateInvoicePdf } = await import("@/lib/invoice-pdf");
  const doc = generateInvoicePdf(data);
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

export function invoiceXmlBytes(xml: string) {
  return strToU8(xml);
}

export function archiveBytes(files: Array<{ fileName: string; bytes: Uint8Array }>) {
  return zipSync(
    Object.fromEntries(files.map((file) => [safeArchiveSegment(file.fileName), file.bytes])),
  );
}
