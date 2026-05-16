import { strToU8, zipSync } from "fflate";

export type BillingExportKind = "fees" | "expenses";

export type BillingExportRow = {
  practiceNumber: number | null;
  clientName: string;
  counterpartyName: string;
  activityDate: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  hearingDates?: string[];
};

export type BillingWorkbookInput = {
  kind: BillingExportKind;
  principalName: string;
  periodStart: string;
  periodEnd: string;
  rows: BillingExportRow[];
};

export type BillingWorkbookFile = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const escapeXml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const safeFileSegment = (value: string) =>
  value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "committente";

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

const workbookDimension = (input: BillingWorkbookInput) => {
  const lastColumn = input.kind === "fees" ? "I" : "G";
  const lastRow = Math.max(input.rows.length + 4, 4);
  return `A1:${lastColumn}${lastRow}`;
};

const worksheet = (input: BillingWorkbookInput) => {
  const title = input.kind === "fees" ? "Rendiconto compensi" : "Rendiconto rimborsi spese";
  const headers =
    input.kind === "fees"
      ? [
          "Pratica",
          "Cliente",
          "Controparte",
          "Data",
          "Voce",
          "Udienze",
          "Quantità",
          "Prezzo unitario",
          "Totale",
        ]
      : ["Pratica", "Cliente", "Controparte", "Data", "Voce", "Quantità", "Importo"];

  const rows: string[] = [
    `<row r="1">${textCell(1, 0, title)}</row>`,
    `<row r="2">${textCell(2, 0, input.principalName)}${textCell(
      2,
      1,
      `${input.periodStart} - ${input.periodEnd}`,
    )}</row>`,
    `<row r="4">${headers.map((header, index) => textCell(4, index, header)).join("")}</row>`,
  ];

  input.rows.forEach((row, index) => {
    const rowIndex = index + 5;
    const common = [
      textCell(rowIndex, 0, row.practiceNumber ?? ""),
      textCell(rowIndex, 1, row.clientName),
      textCell(rowIndex, 2, row.counterpartyName),
      textCell(rowIndex, 3, row.activityDate),
      textCell(rowIndex, 4, row.description),
    ];

    if (input.kind === "fees") {
      rows.push(
        `<row r="${rowIndex}">${[
          ...common,
          textCell(rowIndex, 5, row.hearingDates?.join(", ") ?? ""),
          numberCell(rowIndex, 6, row.quantity),
          numberCell(rowIndex, 7, row.unitPrice),
          numberCell(rowIndex, 8, row.amount),
        ].join("")}</row>`,
      );
      return;
    }

    rows.push(
      `<row r="${rowIndex}">${[
        ...common,
        numberCell(rowIndex, 5, row.quantity),
        numberCell(rowIndex, 6, row.amount),
      ].join("")}</row>`,
    );
  });

  const dimension = workbookDimension(input);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="12" customWidth="1"/>
    <col min="2" max="5" width="28" customWidth="1"/>
    <col min="6" max="9" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
</worksheet>`;
};

export function buildBillingWorkbook(input: BillingWorkbookInput): BillingWorkbookFile {
  const sheetName = input.kind === "fees" ? "Compensi" : "Rimborsi";
  const kindName = input.kind === "fees" ? "compensi" : "rimborsi-spese";
  const fileName = `${kindName}-${safeFileSegment(input.principalName)}-${input.periodStart}-${input.periodEnd}.xlsx`;
  const createdAt = new Date().toISOString();

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Pratix</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Fogli di lavoro</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr"><vt:lpstr>${sheetName}</vt:lpstr></vt:vector>
  </TitlesOfParts>
  <Company>Pratix</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Pratix</dc:creator>
  <cp:lastModifiedBy>Pratix</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="23426"/>
  <workbookPr defaultThemeVersion="164011"/>
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20490" windowHeight="7755"/></bookViews>
  <sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>
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
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normale" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
  };

  return {
    bytes: zipSync(files),
    fileName,
    mimeType: MIME_XLSX,
  };
}
