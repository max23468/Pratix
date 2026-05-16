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
const EURO_FORMAT = '_-* #,##0.00\\ "€"_-;\\-* #,##0.00\\ "€"_-;_-* "-"??\\ "€"_-;_-@_-';

const styles = {
  default: 0,
  notice: 1,
  groupHeader: 2,
  detailHeader: 3,
  text: 4,
  date: 5,
  integer: 6,
  currency: 7,
  totalLabel: 8,
  totalCurrency: 9,
};

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

const cellRef = (rowIndex: number, columnIndex: number) => `${columnName(columnIndex)}${rowIndex}`;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const excelDateSerial = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round(date.getTime() / 86400000 + 25569);
};

const textCell = (
  rowIndex: number,
  columnIndex: number,
  value: string | number | null,
  styleId = styles.text,
) =>
  `<c r="${cellRef(rowIndex, columnIndex)}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(
    value,
  )}</t></is></c>`;

const numberCell = (
  rowIndex: number,
  columnIndex: number,
  value: number,
  styleId = styles.integer,
) =>
  `<c r="${cellRef(rowIndex, columnIndex)}" s="${styleId}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;

const dateCell = (rowIndex: number, columnIndex: number, value: string) => {
  const serial = excelDateSerial(value);
  return serial === null
    ? textCell(rowIndex, columnIndex, value, styles.date)
    : numberCell(rowIndex, columnIndex, serial, styles.date);
};

const formulaCell = (
  rowIndex: number,
  columnIndex: number,
  formula: string,
  styleId = styles.currency,
) => `<c r="${cellRef(rowIndex, columnIndex)}" s="${styleId}"><f>${escapeXml(formula)}</f></c>`;

const rowXml = (rowIndex: number, cells: string[], height?: number) =>
  `<row r="${rowIndex}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells.join("")}</row>`;

type FeeColumn = {
  columnIndex: number;
  group: string;
  detail: string;
  price: number;
  match: (description: string, row: BillingExportRow) => boolean;
};

const feeColumns: FeeColumn[] = [
  {
    columnIndex: 3,
    group: 'Procedura "cartacea" €80,00',
    detail:
      "include domiciliazione della pratica, richiesta e ritiro copie autentiche, richiesta notificazione e ritiro atto notificato",
    price: 80,
    match: (description) => /procedura.*cartace|cartace/.test(description),
  },
  {
    columnIndex: 4,
    group: 'Procedura "telematica" €40,00',
    detail: "richiesta notificazione e ritiro atto notificato",
    price: 40,
    match: (description) => /procedura.*telematic|telematic/.test(description),
  },
  {
    columnIndex: 5,
    group: "Precetto €25,00",
    detail: "include domiciliazione della pratica, notificazione e ritiro atto notificato",
    price: 25,
    match: (description) => /precetto/.test(description),
  },
  {
    columnIndex: 6,
    group: "Pignoramento mobiliare presso terzi",
    detail: "con iscrizione a ruolo",
    price: 90,
    match: (description) =>
      /pignoramento.*mobiliare/.test(description) && /con iscrizione/.test(description),
  },
  {
    columnIndex: 7,
    group: "Pignoramento mobiliare presso terzi",
    detail: "senza iscrizione a ruolo",
    price: 60,
    match: (description) =>
      /pignoramento.*mobiliare/.test(description) && /senza iscrizione/.test(description),
  },
  {
    columnIndex: 8,
    group: "Pignoramento immobiliare diretto €450,00",
    detail: "€150,00 fino all'udienza ex art. 569 c.p.c.",
    price: 150,
    match: (description) =>
      /pignoramento.*immobiliar/.test(description) &&
      /569|udienza/.test(description) &&
      !/12 mesi|decorrenza|distribuzione/.test(description),
  },
  {
    columnIndex: 9,
    group: "Pignoramento immobiliare diretto €450,00",
    detail: "€150,00 decorrenza 12 mesi dall'udienza ex art. 569 c.p.c.",
    price: 150,
    match: (description) =>
      /pignoramento.*immobiliar/.test(description) && /12 mesi|decorrenza/.test(description),
  },
  {
    columnIndex: 10,
    group: "Pignoramento immobiliare diretto €450,00",
    detail: "€150,00 a seguito della distribuzione delle somme",
    price: 150,
    match: (description) =>
      /pignoramento.*immobiliar/.test(description) && /distribuzione/.test(description),
  },
  {
    columnIndex: 11,
    group: "Intervento in procedura esecutiva immobiliare €300,00",
    detail: "€100,00 con il deposito dell'intervento",
    price: 100,
    match: (description) =>
      /intervento/.test(description) &&
      /deposit/.test(description) &&
      !/12 mesi|decorrenza|distribuzione/.test(description),
  },
  {
    columnIndex: 12,
    group: "Intervento in procedura esecutiva immobiliare €300,00",
    detail: "€100,00 decorrenza 12 mesi dal deposito",
    price: 100,
    match: (description) =>
      /intervento/.test(description) && /12 mesi|decorrenza/.test(description),
  },
  {
    columnIndex: 13,
    group: "Intervento in procedura esecutiva immobiliare €300,00",
    detail: "€100,00 a seguito della distribuzione delle somme",
    price: 100,
    match: (description) => /intervento/.test(description) && /distribuzione/.test(description),
  },
  {
    columnIndex: 14,
    group: "Accesso in cancelleria €25,00",
    detail:
      "per ogni accesso in cancelleria o richiesta di notificazione non inclusa in altre fasi",
    price: 25,
    match: (description) => /accesso|cancelleria|notificaz/.test(description),
  },
  {
    columnIndex: 15,
    group: "Procedimenti ordinari / mediazione / esecutivi / concorsuali €40,00",
    detail: "n° udienze sostenute",
    price: 40,
    match: (description, row) =>
      (row.hearingDates?.length ?? 0) > 0 ||
      /udienz|mediazion|ordinari|concorsual/.test(description),
  },
  {
    columnIndex: 18,
    group: "Partecipazione alle vendite",
    detail: "partecipazione vendita senza aggiudicazione",
    price: 100,
    match: (description) => /vendit/.test(description) && /senza aggiudic/.test(description),
  },
  {
    columnIndex: 19,
    group: "Partecipazione alle vendite",
    detail: "partecipazione vendita con aggiudicazione e immissione nel possesso",
    price: 200,
    match: (description) =>
      /vendit/.test(description) && /con aggiudic|immissione/.test(description),
  },
  {
    columnIndex: 20,
    group: "Partecipazione a vendite contestuali €170,00",
    detail: "incontri o udienze per assenso cancellazione ipoteche",
    price: 170,
    match: (description) => /contestual|assenso|ipotech/.test(description),
  },
];

const feeColumnByIndex = new Map(feeColumns.map((column) => [column.columnIndex, column]));
const feeQuantityColumns = feeColumns.map((column) => column.columnIndex);

const matchFeeColumn = (row: BillingExportRow) => {
  const description = normalize(row.description);
  return feeColumns.find((column) => column.match(description, row)) ?? feeColumnByIndex.get(14)!;
};

const expenseColumns = [
  {
    columnIndex: 5,
    header: "COSTO NOTIFICA",
    match: (description: string) => /notific/.test(description) && !/precetto/.test(description),
  },
  {
    columnIndex: 6,
    header: "COSTO NOTIFICA PRECETTO",
    match: (description: string) => /notific/.test(description) && /precetto/.test(description),
  },
  {
    columnIndex: 7,
    header: "COSTO PIGNORAMENTO €",
    match: (description: string) => /pignor/.test(description),
  },
  {
    columnIndex: 8,
    header: "EVENTUALE IMPORTO DEL CONGUAGLIO",
    match: (description: string) => /conguaglio/.test(description),
  },
  {
    columnIndex: 9,
    header: "MARCHE DA BOLLO",
    match: (description: string) => /marca|bollo/.test(description),
  },
  {
    columnIndex: 10,
    header: "Altre spese (es. spedizioni)",
    match: () => true,
  },
];

const matchExpenseColumn = (row: BillingExportRow) => {
  const description = normalize(row.description);
  return (
    expenseColumns.find((column) => column.match(description)) ??
    expenseColumns[expenseColumns.length - 1]
  );
};

const feesWorksheet = (input: BillingWorkbookInput) => {
  const dataRows = Math.max(input.rows.length, 1);
  const firstDataRow = 5;
  const lastDataRow = firstDataRow + dataRows - 1;
  const totalRow = lastDataRow + 2;
  const grandTotalRow = totalRow + 2;

  const rows: string[] = [
    rowXml(
      1,
      [
        textCell(
          1,
          0,
          "ATTENZIONE: IL FOGLIO CONTIENE FORMULE. INSERIRE SOLO IL NUMERO DI ATTIVITÀ NELLA CELLA CORRISPONDENTE.",
          styles.notice,
        ),
      ],
      54,
    ),
    rowXml(
      2,
      [
        textCell(2, 3, feeColumnByIndex.get(3)!.group, styles.groupHeader),
        textCell(2, 4, feeColumnByIndex.get(4)!.group, styles.groupHeader),
        textCell(2, 5, feeColumnByIndex.get(5)!.group, styles.groupHeader),
        textCell(2, 6, feeColumnByIndex.get(6)!.group, styles.groupHeader),
        textCell(2, 8, feeColumnByIndex.get(8)!.group, styles.groupHeader),
        textCell(2, 11, feeColumnByIndex.get(11)!.group, styles.groupHeader),
        textCell(2, 14, feeColumnByIndex.get(14)!.group, styles.groupHeader),
        textCell(2, 15, feeColumnByIndex.get(15)!.group, styles.groupHeader),
        textCell(2, 18, feeColumnByIndex.get(18)!.group, styles.groupHeader),
        textCell(2, 20, feeColumnByIndex.get(20)!.group, styles.groupHeader),
      ],
      92,
    ),
    rowXml(
      3,
      [
        textCell(3, 0, "DATA ATTIVITÀ", styles.detailHeader),
        textCell(3, 1, "CLIENTE", styles.detailHeader),
        textCell(3, 2, "NDG-DENOMINAZIONE", styles.detailHeader),
        ...feeColumns.map((column) =>
          textCell(3, column.columnIndex, column.detail, styles.detailHeader),
        ),
        textCell(3, 16, "Data udienza", styles.detailHeader),
        textCell(3, 17, "Data udienza", styles.detailHeader),
      ],
      92,
    ),
  ];

  input.rows.forEach((billingRow, index) => {
    const rowIndex = firstDataRow + index;
    const matchedColumn = matchFeeColumn(billingRow);
    const hearingDates = billingRow.hearingDates ?? [];
    const cells = [
      dateCell(rowIndex, 0, billingRow.activityDate),
      textCell(rowIndex, 1, billingRow.clientName),
      textCell(
        rowIndex,
        2,
        billingRow.practiceNumber
          ? `${billingRow.practiceNumber} - ${billingRow.counterpartyName}`
          : billingRow.counterpartyName,
      ),
      numberCell(rowIndex, matchedColumn.columnIndex, billingRow.quantity),
    ];

    if (matchedColumn.columnIndex === 15) {
      cells.push(
        ...hearingDates
          .slice(0, 2)
          .map((date, hearingIndex) => dateCell(rowIndex, 16 + hearingIndex, date)),
      );
    }

    rows.push(rowXml(rowIndex, cells, 23));
  });

  if (input.rows.length === 0) {
    rows.push(rowXml(firstDataRow, [textCell(firstDataRow, 1, input.principalName)], 23));
  }

  rows.push(
    rowXml(
      totalRow,
      [
        textCell(totalRow, 2, "Totale per voce", styles.totalLabel),
        ...feeQuantityColumns.map((columnIndex) => {
          const column = feeColumnByIndex.get(columnIndex)!;
          return formulaCell(
            totalRow,
            columnIndex,
            `SUM(${columnName(columnIndex)}${firstDataRow}:${columnName(columnIndex)}${lastDataRow})*${column.price}`,
            styles.totalCurrency,
          );
        }),
      ],
      23,
    ),
    rowXml(
      grandTotalRow,
      [
        textCell(grandTotalRow, 2, "TOTALE COMPENSI", styles.totalLabel),
        formulaCell(
          grandTotalRow,
          3,
          `SUM(D${totalRow}:P${totalRow},S${totalRow}:U${totalRow})`,
          styles.totalCurrency,
        ),
      ],
      23,
    ),
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:U${grandTotalRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane xSplit="3" ySplit="4" topLeftCell="D5" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="11.83" customWidth="1"/>
    <col min="2" max="2" width="13" customWidth="1"/>
    <col min="3" max="3" width="34.33" customWidth="1"/>
    <col min="4" max="4" width="25.66" customWidth="1"/>
    <col min="5" max="5" width="21.83" customWidth="1"/>
    <col min="6" max="6" width="17.16" customWidth="1"/>
    <col min="7" max="7" width="29.16" customWidth="1"/>
    <col min="8" max="8" width="13" customWidth="1"/>
    <col min="9" max="9" width="23.16" customWidth="1"/>
    <col min="10" max="10" width="21.66" customWidth="1"/>
    <col min="11" max="11" width="19.5" customWidth="1"/>
    <col min="12" max="12" width="26" customWidth="1"/>
    <col min="13" max="13" width="22.66" customWidth="1"/>
    <col min="14" max="14" width="14.83" customWidth="1"/>
    <col min="15" max="15" width="21.66" customWidth="1"/>
    <col min="16" max="16" width="12.83" customWidth="1"/>
    <col min="17" max="18" width="13" customWidth="1"/>
    <col min="19" max="19" width="22.5" customWidth="1"/>
    <col min="20" max="20" width="35.83" customWidth="1"/>
    <col min="21" max="21" width="12.16" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
  <mergeCells count="7">
    <mergeCell ref="A1:U1"/>
    <mergeCell ref="G2:H2"/>
    <mergeCell ref="I2:K2"/>
    <mergeCell ref="L2:N2"/>
    <mergeCell ref="P2:R2"/>
    <mergeCell ref="S2:T2"/>
    <mergeCell ref="D${grandTotalRow}:E${grandTotalRow}"/>
  </mergeCells>
</worksheet>`;
};

const expensesWorksheet = (input: BillingWorkbookInput) => {
  const dataRows = Math.max(input.rows.length, 1);
  const firstDataRow = 2;
  const lastDataRow = firstDataRow + dataRows - 1;
  const totalRow = lastDataRow + 2;

  const rows = [
    rowXml(
      1,
      [
        textCell(1, 1, "DATA SPESA", styles.detailHeader),
        textCell(1, 2, "CLIENTE", styles.detailHeader),
        textCell(1, 3, "NDG-DENOMINAZIONE", styles.detailHeader),
        textCell(1, 4, "N° TENTATIVO NOTIFICA (es: prima, seconda etc.)", styles.detailHeader),
        ...expenseColumns.map((column) =>
          textCell(1, column.columnIndex, column.header, styles.detailHeader),
        ),
      ],
      96,
    ),
  ];

  input.rows.forEach((billingRow, index) => {
    const rowIndex = firstDataRow + index;
    const matchedColumn = matchExpenseColumn(billingRow);
    rows.push(
      rowXml(rowIndex, [
        dateCell(rowIndex, 1, billingRow.activityDate),
        textCell(rowIndex, 2, billingRow.clientName),
        textCell(
          rowIndex,
          3,
          billingRow.practiceNumber
            ? `${billingRow.practiceNumber} - ${billingRow.counterpartyName}`
            : billingRow.counterpartyName,
        ),
        textCell(rowIndex, 4, ""),
        numberCell(rowIndex, matchedColumn.columnIndex, billingRow.amount, styles.currency),
      ]),
    );
  });

  if (input.rows.length === 0) {
    rows.push(rowXml(firstDataRow, [textCell(firstDataRow, 2, input.principalName)]));
  }

  rows.push(
    rowXml(totalRow, [
      textCell(totalRow, 3, "TOTALE RIMBORSI SPESE", styles.totalLabel),
      ...expenseColumns.map((column) =>
        formulaCell(
          totalRow,
          column.columnIndex,
          `SUM(${columnName(column.columnIndex)}${firstDataRow}:${columnName(column.columnIndex)}${lastDataRow})`,
          styles.totalCurrency,
        ),
      ),
    ]),
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="B1:K${totalRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="2.66" customWidth="1"/>
    <col min="2" max="2" width="20.83" customWidth="1"/>
    <col min="3" max="3" width="19.5" customWidth="1"/>
    <col min="4" max="4" width="34.16" customWidth="1"/>
    <col min="5" max="5" width="11.83" customWidth="1"/>
    <col min="6" max="6" width="9.83" customWidth="1"/>
    <col min="7" max="7" width="10.83" customWidth="1"/>
    <col min="8" max="8" width="16.83" customWidth="1"/>
    <col min="9" max="9" width="13.5" customWidth="1"/>
    <col min="10" max="10" width="9.83" customWidth="1"/>
    <col min="11" max="11" width="13.83" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
</worksheet>`;
};

const worksheet = (input: BillingWorkbookInput) =>
  input.kind === "fees" ? feesWorksheet(input) : expensesWorksheet(input);

const workbookXml = (sheetName: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="600" windowWidth="28800" windowHeight="16120"/></bookViews>
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`;

const stylesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="mm-dd-yy"/>
    <numFmt numFmtId="165" formatCode="${escapeXml(EURO_FORMAT)}"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FF9C0006"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAD3"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="165" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function buildBillingWorkbook(input: BillingWorkbookInput): BillingWorkbookFile {
  const sheetName = input.kind === "fees" ? "Compensi" : "Spese";
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
    "xl/workbook.xml": strToU8(workbookXml(sheetName)),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(worksheet(input)),
    "xl/styles.xml": strToU8(stylesXml()),
  };

  return {
    bytes: zipSync(files),
    fileName,
    mimeType: MIME_XLSX,
  };
}
