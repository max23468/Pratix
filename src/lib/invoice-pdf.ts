/** Generazione PDF fattura (cortesia) con jsPDF. */
import { jsPDF } from "jspdf";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceLineKindLabels, type InvoiceLineKind } from "@/lib/invoice-calc";
import { clientDisplayName } from "@/lib/labels";

export type InvoicePdfData = {
  invoice: {
    number: string;
    year: number;
    issue_date: string;
    due_date: string | null;
    notes: string | null;
    taxable_fees: number;
    art15_expenses: number;
    general_expenses_amount: number;
    cassa_amount: number;
    vat_amount: number;
    withholding_amount: number;
    stamp_amount: number;
    total_amount: number;
    net_to_pay: number;
    cassa_rate: number;
    vat_rate: number;
    withholding_rate: number;
    apply_withholding: boolean;
  };
  lines: Array<{
    kind: InvoiceLineKind;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  client: {
    kind: string;
    first_name?: string | null;
    last_name?: string | null;
    business_name?: string | null;
    tax_code?: string | null;
    vat_number?: string | null;
    address_street?: string | null;
    address_zip?: string | null;
    address_city?: string | null;
    address_province?: string | null;
  };
  profile: {
    business_name?: string | null;
    full_name?: string | null;
    vat_number?: string | null;
    tax_code?: string | null;
    address_street?: string | null;
    address_zip?: string | null;
    address_city?: string | null;
    address_province?: string | null;
    pec?: string | null;
    email?: string | null;
    phone?: string | null;
    bar_association?: string | null;
    iban?: string | null;
    bank_name?: string | null;
    tax_regime?: string | null;
  };
};

const MARGIN = 15;

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN;

  // Intestazione professionista
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const headerName = data.profile.business_name || data.profile.full_name || "Avvocato";
  doc.text(headerName, MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const headerLines: string[] = [];
  if (data.profile.address_street) {
    const addr = [
      data.profile.address_street,
      [data.profile.address_zip, data.profile.address_city, data.profile.address_province]
        .filter(Boolean)
        .join(" "),
    ]
      .filter(Boolean)
      .join(" — ");
    headerLines.push(addr);
  }
  if (data.profile.vat_number) headerLines.push(`P.IVA: ${data.profile.vat_number}`);
  if (data.profile.tax_code) headerLines.push(`C.F.: ${data.profile.tax_code}`);
  if (data.profile.bar_association)
    headerLines.push(`Iscritto all'Ordine degli Avvocati di ${data.profile.bar_association}`);
  if (data.profile.email) headerLines.push(`Email: ${data.profile.email}`);
  if (data.profile.pec) headerLines.push(`PEC: ${data.profile.pec}`);
  if (data.profile.phone) headerLines.push(`Tel: ${data.profile.phone}`);
  headerLines.forEach((l) => {
    doc.text(l, MARGIN, y);
    y += 4;
  });

  // Titolo fattura (a destra)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FATTURA", pageWidth - MARGIN, MARGIN, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`N. ${data.invoice.number} / ${data.invoice.year}`, pageWidth - MARGIN, MARGIN + 6, {
    align: "right",
  });
  doc.text(`Data: ${formatDate(data.invoice.issue_date)}`, pageWidth - MARGIN, MARGIN + 11, {
    align: "right",
  });
  if (data.invoice.due_date) {
    doc.text(`Scadenza: ${formatDate(data.invoice.due_date)}`, pageWidth - MARGIN, MARGIN + 16, {
      align: "right",
    });
  }

  y = Math.max(y, MARGIN + 22) + 6;

  // Committente
  doc.setDrawColor(220);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Committente", MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(clientDisplayName(data.client), MARGIN, y);
  y += 4;
  const cliAddr = [
    data.client.address_street,
    [data.client.address_zip, data.client.address_city, data.client.address_province]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(" — ");
  if (cliAddr) {
    doc.text(cliAddr, MARGIN, y);
    y += 4;
  }
  if (data.client.vat_number) {
    doc.text(`P.IVA: ${data.client.vat_number}`, MARGIN, y);
    y += 4;
  }
  if (data.client.tax_code) {
    doc.text(`C.F.: ${data.client.tax_code}`, MARGIN, y);
    y += 4;
  }

  y += 4;
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 6;

  // Tabella righe
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const colDesc = MARGIN;
  const colQty = pageWidth - MARGIN - 70;
  const colPrice = pageWidth - MARGIN - 40;
  const colAmount = pageWidth - MARGIN;
  doc.text("Descrizione", colDesc, y);
  doc.text("Q.tà", colQty, y, { align: "right" });
  doc.text("Prezzo", colPrice, y, { align: "right" });
  doc.text("Importo", colAmount, y, { align: "right" });
  y += 2;
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  for (const l of data.lines) {
    if (y > 260) {
      doc.addPage();
      y = MARGIN;
    }
    const desc = `[${invoiceLineKindLabels[l.kind]}] ${l.description}`;
    const wrapped = doc.splitTextToSize(desc, colQty - colDesc - 4);
    doc.text(wrapped, colDesc, y);
    doc.text(String(l.quantity), colQty, y, { align: "right" });
    doc.text(formatCurrency(l.unit_price), colPrice, y, { align: "right" });
    doc.text(formatCurrency(l.amount), colAmount, y, { align: "right" });
    y += Math.max(wrapped.length * 4, 4) + 1;
  }

  y += 4;
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 6;

  // Riepilogo fiscale
  const labelX = pageWidth - MARGIN - 60;
  const valueX = pageWidth - MARGIN;
  const row = (label: string, value: string, bold = false) => {
    if (y > 270) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, y, { align: "right" });
    doc.text(value, valueX, y, { align: "right" });
    y += 5;
  };

  doc.setFontSize(9);
  if (data.invoice.taxable_fees > 0)
    row("Imponibile compensi", formatCurrency(data.invoice.taxable_fees));
  if (data.invoice.general_expenses_amount > 0)
    row("Spese generali", formatCurrency(data.invoice.general_expenses_amount));
  if (data.invoice.cassa_amount > 0)
    row(`Cassa Forense (${data.invoice.cassa_rate}%)`, formatCurrency(data.invoice.cassa_amount));
  if (data.invoice.vat_amount > 0)
    row(`IVA (${data.invoice.vat_rate}%)`, formatCurrency(data.invoice.vat_amount));
  if (data.invoice.art15_expenses > 0)
    row("Spese Art. 15 (escluse IVA)", formatCurrency(data.invoice.art15_expenses));
  if (data.invoice.stamp_amount > 0) row("Bollo", formatCurrency(data.invoice.stamp_amount));

  y += 1;
  doc.setDrawColor(150);
  doc.line(labelX - 5, y, valueX, y);
  y += 4;
  row("Totale documento", formatCurrency(data.invoice.total_amount), true);

  if (data.invoice.withholding_amount > 0) {
    row(
      `Ritenuta d'acconto (${data.invoice.withholding_rate}%)`,
      `− ${formatCurrency(data.invoice.withholding_amount)}`,
    );
    y += 1;
    doc.line(labelX - 5, y, valueX, y);
    y += 4;
    row("Netto a pagare", formatCurrency(data.invoice.net_to_pay), true);
  }

  // Pagamento
  y += 6;
  if (data.profile.iban) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Coordinate per il pagamento", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    if (data.profile.bank_name) {
      doc.text(`Banca: ${data.profile.bank_name}`, MARGIN, y);
      y += 4;
    }
    doc.text(`IBAN: ${data.profile.iban}`, MARGIN, y);
    y += 4;
  }

  if (data.profile.tax_regime === "forfettario") {
    y += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    const note =
      "Operazione effettuata ai sensi dell'art. 1, commi da 54 a 89, L. 190/2014 — regime forfettario. " +
      "Non soggetta a IVA né a ritenuta d'acconto.";
    const wrap = doc.splitTextToSize(note, pageWidth - 2 * MARGIN);
    doc.text(wrap, MARGIN, y);
    y += wrap.length * 4;
  }

  if (data.invoice.notes) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Note", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const wrap = doc.splitTextToSize(data.invoice.notes, pageWidth - 2 * MARGIN);
    doc.text(wrap, MARGIN, y);
  }

  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData): void {
  const doc = generateInvoicePdf(data);
  const filename = `Fattura_${data.invoice.year}_${data.invoice.number.replace(/\//g, "-")}.pdf`;
  doc.save(filename);
}
