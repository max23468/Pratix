import { strToU8, zipSync } from "fflate";
import { generateInvoicePdf, type InvoicePdfData } from "@/lib/invoice-pdf";

export type InvoiceXmlFile = {
  filename: string;
  xml: string;
};

export type InvoiceArchiveFile = {
  path: string;
  bytes: Uint8Array;
};

const MIME_ZIP = "application/zip";

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

export function buildInvoiceArchiveFileName({
  periodStart,
  periodEnd,
}: {
  periodStart?: string;
  periodEnd?: string;
}) {
  const suffix =
    periodStart && periodEnd
      ? `${safeArchiveSegment(periodStart)}_${safeArchiveSegment(periodEnd)}`
      : new Date().toISOString().slice(0, 10);
  return `fatture-pratix-${suffix}.zip`;
}

export function buildInvoiceArchive(files: InvoiceArchiveFile[]) {
  const entries: Record<string, Uint8Array> = {};

  for (const file of files) {
    entries[file.path] = file.bytes;
  }

  return {
    bytes: zipSync(entries),
    fileName: buildInvoiceArchiveFileName({}),
    mimeType: MIME_ZIP,
  };
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

export function buildSingleInvoiceFiles({
  invoice,
  xml,
}: {
  invoice: InvoicePdfData;
  xml: InvoiceXmlFile;
}) {
  const base = `fattura-${safeArchiveSegment(invoice.invoice.year)}-${safeArchiveSegment(
    invoice.invoice.number,
  )}`;

  return [
    {
      path: `${base}/${invoicePdfFileName(invoice.invoice)}`,
      bytes: invoicePdfBytes(invoice),
    },
    {
      path: `${base}/${xml.filename}`,
      bytes: invoiceXmlBytes(xml.xml),
    },
  ] satisfies InvoiceArchiveFile[];
}
