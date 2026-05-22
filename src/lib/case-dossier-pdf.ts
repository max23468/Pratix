import { jsPDF } from "jspdf";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CaseDossierInput } from "@/lib/case-dossier-xlsx";

const MARGIN = 15;

const safeFileSegment = (value: string | number) =>
  String(value)
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "pratica";

export function caseDossierPdfFileName(input: Pick<CaseDossierInput, "practiceNumber">) {
  return `dossier-pratica-${safeFileSegment(input.practiceNumber)}.pdf`;
}

export function generateCaseDossierPdf(input: CaseDossierInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const ensureSpace = (height = 12) => {
    if (y + height <= 285) return;
    doc.addPage();
    y = MARGIN;
  };

  const section = (title: string) => {
    ensureSpace(12);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, MARGIN, y);
    y += 4;
    doc.setDrawColor(210);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 6;
  };

  const line = (label: string, value: string | number | null | undefined) => {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(String(value || "-"), contentWidth - 42);
    doc.text(wrapped, MARGIN + 42, y);
    y += Math.max(wrapped.length * 4, 5);
  };

  const bullet = (title: string, description: string, meta?: string, amount?: number | null) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, MARGIN, y);
    if (amount) {
      doc.text(formatCurrency(amount), pageWidth - MARGIN, y, { align: "right" });
    }
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const text = [meta, description].filter(Boolean).join(" - ");
    const wrapped = doc.splitTextToSize(text || "-", contentWidth);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 4 + 2;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Dossier pratica", MARGIN, y);
  doc.setFontSize(10);
  doc.text(`Pratica ${input.practiceNumber}`, pageWidth - MARGIN, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(input.title, MARGIN, y);
  y += 8;

  section("Soggetti e stato");
  line("Stato", input.status);
  line("Apertura", formatDate(input.openedAt));
  if (input.closedAt) line("Chiusura", formatDate(input.closedAt));
  line("Committente", input.principalName);
  line("Cliente", input.clientName);
  line("Controparte", input.counterpartyName);
  if (input.authority) line("Autorità", input.authority);
  if (input.rgNumber) line("N. R.G.", input.rgNumber);
  if (input.notes) line("Note", input.notes);

  const activityTotal = input.activities.reduce((sum, activity) => sum + activity.amount, 0);
  const invoiceTotal = input.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);

  section("Riepilogo economico");
  line("Maturato attività", formatCurrency(activityTotal));
  line("Totale fatture", formatCurrency(invoiceTotal));
  line("Attività", input.activities.length);
  line("Fatture", input.invoices.length);

  section("Attività");
  if (input.activities.length === 0) {
    line("Stato", "Nessuna attività registrata.");
  } else {
    input.activities.forEach((activity) => {
      bullet(
        `${formatDate(activity.activityDate)} · ${activity.description}`,
        [
          activity.hearingDates.length ? `Udienze: ${activity.hearingDates.join(", ")}` : "",
          activity.attachmentNames.length ? `Allegati: ${activity.attachmentNames.join(", ")}` : "",
          activity.notes ?? "",
        ]
          .filter(Boolean)
          .join(" - "),
        [activity.kind, activity.status, activity.needsReview ? "Da verificare" : ""]
          .filter(Boolean)
          .join(" · "),
        activity.amount,
      );
    });
  }

  section("Fatture e storico");
  input.invoices.forEach((invoice) => {
    bullet(
      `Fattura ${invoice.number}/${invoice.year}`,
      [invoice.dueDate ? `Scadenza ${formatDate(invoice.dueDate)}` : "", invoice.notes ?? ""]
        .filter(Boolean)
        .join(" - "),
      invoice.status,
      invoice.totalAmount,
    );
  });
  input.history.forEach((item) => {
    bullet(
      `Cambio stato · ${formatDate(item.changedAt)}`,
      item.note ?? "",
      item.previousStatus ? `${item.previousStatus} -> ${item.newStatus}` : item.newStatus,
    );
  });
  input.transfers.forEach((transfer) => {
    bullet(
      `Cessione credito · ${formatDate(transfer.transferredAt)}`,
      `${transfer.previousClientName} -> ${transfer.newClientName}`,
      "Cliente",
    );
  });

  return doc;
}

export function downloadCaseDossierPdf(input: CaseDossierInput) {
  generateCaseDossierPdf(input).save(caseDossierPdfFileName(input));
}
