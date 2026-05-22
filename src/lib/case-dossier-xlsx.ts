import { strToU8, zipSync } from "fflate";

export type CaseDossierActivity = {
  activityDate: string;
  kind: string;
  status: string;
  needsReview?: boolean | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  hearingDates: string[];
  attachmentNames: string[];
  notes?: string | null;
};

export type CaseDossierInvoice = {
  issueDate: string;
  dueDate?: string | null;
  paidAt?: string | null;
  number: string;
  year: number;
  status: string;
  totalAmount: number;
  notes?: string | null;
};

export type CaseDossierHistoryItem = {
  changedAt: string;
  previousStatus?: string | null;
  newStatus: string;
  note?: string | null;
};

export type CaseDossierTransfer = {
  transferredAt: string;
  previousClientName: string;
  newClientName: string;
};

export type CaseDossierInput = {
  practiceNumber: number;
  title: string;
  status: string;
  openedAt: string;
  closedAt?: string | null;
  principalName: string;
  clientName: string;
  counterpartyName: string;
  authority?: string | null;
  rgNumber?: string | null;
  notes?: string | null;
  activities: CaseDossierActivity[];
  invoices: CaseDossierInvoice[];
  history: CaseDossierHistoryItem[];
  transfers: CaseDossierTransfer[];
};

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const escapeXml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const safeFileSegment = (value: string | number) =>
  String(value)
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "pratica";

const columnName = (index: number) => {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
};

const textCell = (rowIndex: number, columnIndex: number, value: string | number | null) =>
  `<c r="${columnName(columnIndex)}${rowIndex}" t="inlineStr"><is><t>${escapeXml(
    value,
  )}</t></is></c>`;

const numberCell = (rowIndex: number, columnIndex: number, value: number) =>
  `<c r="${columnName(columnIndex)}${rowIndex}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;

type DossierRow = {
  section: string;
  date: string;
  type: string;
  description: string;
  status: string;
  amount: number | null;
  notes: string;
};

function dossierRows(input: CaseDossierInput): DossierRow[] {
  return [
    {
      section: "Pratica",
      date: input.openedAt,
      type: `Pratica ${input.practiceNumber}`,
      description: input.title,
      status: input.status,
      amount: null,
      notes: [
        `Committente: ${input.principalName}`,
        `Cliente: ${input.clientName}`,
        `Controparte: ${input.counterpartyName}`,
        input.authority ? `Autorità: ${input.authority}` : "",
        input.rgNumber ? `RG: ${input.rgNumber}` : "",
        input.notes ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
    },
    ...input.transfers.map((transfer) => ({
      section: "Cessioni credito",
      date: transfer.transferredAt,
      type: "Cessione",
      description: `${transfer.previousClientName} → ${transfer.newClientName}`,
      status: "",
      amount: null,
      notes: "",
    })),
    ...input.activities.map((activity) => ({
      section: "Attività",
      date: activity.activityDate,
      type: activity.kind,
      description: activity.description,
      status: [activity.status, activity.needsReview ? "Da verificare" : ""]
        .filter(Boolean)
        .join(" · "),
      amount: activity.amount,
      notes: [
        `Quantità: ${activity.quantity}`,
        `Prezzo unitario: ${activity.unitPrice}`,
        activity.hearingDates.length ? `Udienze: ${activity.hearingDates.join(", ")}` : "",
        activity.attachmentNames.length ? `Allegati: ${activity.attachmentNames.join(", ")}` : "",
        activity.notes ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    ...input.invoices.map((invoice) => ({
      section: "Fatture",
      date: invoice.issueDate,
      type: `Fattura ${invoice.number}/${invoice.year}`,
      description: invoice.dueDate ? `Scadenza ${invoice.dueDate}` : "Fattura collegata",
      status: invoice.status,
      amount: invoice.totalAmount,
      notes: [invoice.paidAt ? `Pagata il ${invoice.paidAt}` : "", invoice.notes ?? ""]
        .filter(Boolean)
        .join(" · "),
    })),
    ...input.history.map((item) => ({
      section: "Storico stati",
      date: item.changedAt,
      type: "Cambio stato",
      description: item.previousStatus
        ? `${item.previousStatus} → ${item.newStatus}`
        : item.newStatus,
      status: item.newStatus,
      amount: null,
      notes: item.note ?? "",
    })),
  ];
}

function worksheet(input: CaseDossierInput) {
  const headers = ["Sezione", "Data", "Tipo", "Descrizione", "Stato", "Importo", "Note"];
  const rows: string[] = [
    `<row r="1">${textCell(1, 0, "Dossier pratica")}${textCell(
      1,
      1,
      `Pratica ${input.practiceNumber}`,
    )}</row>`,
    `<row r="3">${headers.map((header, index) => textCell(3, index, header)).join("")}</row>`,
  ];

  dossierRows(input).forEach((row, index) => {
    const rowIndex = index + 4;
    rows.push(
      `<row r="${rowIndex}">${[
        textCell(rowIndex, 0, row.section),
        textCell(rowIndex, 1, row.date),
        textCell(rowIndex, 2, row.type),
        textCell(rowIndex, 3, row.description),
        textCell(rowIndex, 4, row.status),
        row.amount === null ? textCell(rowIndex, 5, "") : numberCell(rowIndex, 5, row.amount),
        textCell(rowIndex, 6, row.notes),
      ].join("")}</row>`,
    );
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="3" width="22" customWidth="1"/>
    <col min="4" max="4" width="42" customWidth="1"/>
    <col min="5" max="6" width="18" customWidth="1"/>
    <col min="7" max="7" width="64" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
</worksheet>`;
}

export function buildCaseDossierWorkbook(input: CaseDossierInput) {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Dossier pratica" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(worksheet(input)),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`),
  };

  return {
    bytes: zipSync(files),
    fileName: `dossier-pratica-${safeFileSegment(input.practiceNumber)}.xlsx`,
    mimeType: MIME_XLSX,
  };
}
