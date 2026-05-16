import { strToU8 } from "fflate";
import { generateInvoicePdf, type InvoicePdfData } from "@/lib/invoice-pdf";

export function safeArchiveSegment(value: string | number | null | undefined) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9_. -]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return cleaned || "file";
}

export function invoicePdfFileName(invoice: InvoicePdfData["invoice"]) {
  return `Fattura_${safeArchiveSegment(invoice.year)}_${safeArchiveSegment(invoice.number)}.pdf`;
}

export function invoicePdfBytes(data: InvoicePdfData) {
  const doc = generateInvoicePdf(data);
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

export function invoiceXmlBytes(xml: string) {
  return strToU8(xml);
}

export function downloadBytes({
  bytes,
  fileName,
  mimeType,
}: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
