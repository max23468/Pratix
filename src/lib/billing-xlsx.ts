import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import {
  BILLING_EXPENSES_TEMPLATE_BASE64,
  BILLING_FEES_TEMPLATE_BASE64,
} from "./billing-xlsx-template-data";

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

const cellRef = (rowIndex: number, columnIndex: number) => `${columnName(columnIndex)}${rowIndex}`;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const excelNumberLiteral = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000000) / 1000000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(6).replace(/0+$/, "");
};

const excelDateSerial = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round(date.getTime() / 86400000 + 25569);
};

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

type TemplateConfig = {
  templateBase64: string;
  sheetName: string;
  kindName: string;
  dataStartRow: number;
  templateDataEndRow: number;
  totalRow: number;
  grandTotalRow: number;
  dimensionStartCell: string;
  dimensionColumn: string;
  trailingDimensionRow?: number;
  clonedMergeColumns?: Array<[string, string]>;
};

const templateConfigs: Record<BillingExportKind, TemplateConfig> = {
  fees: {
    templateBase64: BILLING_FEES_TEMPLATE_BASE64,
    sheetName: "Compensi",
    kindName: "compensi",
    dataStartRow: 5,
    templateDataEndRow: 55,
    totalRow: 56,
    grandTotalRow: 58,
    dimensionStartCell: "A1",
    dimensionColumn: "LD",
    clonedMergeColumns: [
      ["Q", "R"],
      ["U", "V"],
    ],
  },
  expenses: {
    templateBase64: BILLING_EXPENSES_TEMPLATE_BASE64,
    sheetName: "Spese",
    kindName: "rimborsi-spese",
    dataStartRow: 2,
    templateDataEndRow: 35,
    totalRow: 36,
    grandTotalRow: 38,
    dimensionStartCell: "B1",
    dimensionColumn: "K",
    trailingDimensionRow: 86,
  },
};

const base64ToBytes = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

const templateDataRows = (config: TemplateConfig) =>
  config.templateDataEndRow - config.dataStartRow + 1;

const cellRefParts = (ref: string) => {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid Excel cell ref: ${ref}`);
  return { column: match[1], row: Number(match[2]) };
};

const shiftCellRef = (ref: string, afterRow: number, offset: number) => {
  const { column, row } = cellRefParts(ref);
  return row > afterRow ? `${column}${row + offset}` : ref;
};

const shiftRangeRef = (ref: string, afterRow: number, offset: number) =>
  ref
    .split(":")
    .map((cell) => shiftCellRef(cell, afterRow, offset))
    .join(":");

const rowRegex = /<row\b[^>]*\br="(\d+)"[\s\S]*?<\/row>/g;

const parseRows = (sheetXml: string) =>
  [...sheetXml.matchAll(rowRegex)].map((match) => ({
    row: Number(match[1]),
    xml: match[0],
  }));

const shiftRowXml = (rowXml: string, fromRow: number, toRow: number) =>
  rowXml
    .replace(new RegExp(`\\br="${fromRow}"`), `r="${toRow}"`)
    .replace(new RegExp(`\\br="([A-Z]+)${fromRow}"`, "g"), `r="$1${toRow}"`);

const cellXmlPattern = (row: number, columnIndex: number) =>
  new RegExp(
    `<c\\b(?=[^>]*\\br="${cellRef(row, columnIndex)}")[^>]*\\/>|<c\\b(?=[^>]*\\br="${cellRef(
      row,
      columnIndex,
    )}")[^>]*>[\\s\\S]*?<\\/c>`,
  );

const cellStyleAttribute = (cellXml?: string) => cellXml?.match(/\bs="([^"]+)"/)?.[0] ?? "";

const emptyCell = (row: number, columnIndex: number, existingCell?: string) =>
  `<c r="${cellRef(row, columnIndex)}"${cellStyleAttribute(existingCell) ? ` ${cellStyleAttribute(existingCell)}` : ""}/>`;

const stringCellFromTemplate = (
  row: number,
  columnIndex: number,
  value: string | number | null,
  existingCell?: string,
) =>
  `<c r="${cellRef(row, columnIndex)}"${cellStyleAttribute(existingCell) ? ` ${cellStyleAttribute(existingCell)}` : ""} t="inlineStr"><is><t>${escapeXml(
    value,
  )}</t></is></c>`;

const numberCellFromTemplate = (
  row: number,
  columnIndex: number,
  value: number,
  existingCell?: string,
) =>
  `<c r="${cellRef(row, columnIndex)}"${cellStyleAttribute(existingCell) ? ` ${cellStyleAttribute(existingCell)}` : ""}><v>${Number.isFinite(value) ? value : 0}</v></c>`;

const formulaCellFromTemplate = (
  row: number,
  columnIndex: number,
  formula: string,
  existingCell?: string,
) =>
  `<c r="${cellRef(row, columnIndex)}"${cellStyleAttribute(existingCell) ? ` ${cellStyleAttribute(existingCell)}` : ""}><f>${escapeXml(formula)}</f></c>`;

const dateCellFromTemplate = (
  row: number,
  columnIndex: number,
  value: string,
  existingCell?: string,
) => {
  const serial = excelDateSerial(value);
  return serial === null
    ? stringCellFromTemplate(row, columnIndex, value, existingCell)
    : numberCellFromTemplate(row, columnIndex, serial, existingCell);
};

const setCell = (
  rowXml: string,
  row: number,
  columnIndex: number,
  build: (existingCell?: string) => string,
) => {
  const pattern = cellXmlPattern(row, columnIndex);
  const existingCell = rowXml.match(pattern)?.[0];
  const nextCell = build(existingCell);
  return existingCell
    ? rowXml.replace(pattern, nextCell)
    : rowXml.replace("</row>", `${nextCell}</row>`);
};

const clearDataRow = (rowXml: string, row: number, lastColumnIndex: number) => {
  let nextRow = rowXml;
  for (let columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex += 1) {
    nextRow = setCell(nextRow, row, columnIndex, (existingCell) =>
      emptyCell(row, columnIndex, existingCell),
    );
  }
  return nextRow;
};

const counterpartyLabel = (row: BillingExportRow) => row.counterpartyName;

const buildTemplateRows = (sheetXml: string, config: TemplateConfig, dataRowCount: number) => {
  const rows = parseRows(sheetXml);
  const templateRowsByNumber = new Map(rows.map((row) => [row.row, row.xml]));
  const addRows = Math.max(0, dataRowCount - templateDataRows(config));
  const outputRows: string[] = [];

  for (const row of rows) {
    if (row.row < config.dataStartRow) outputRows.push(row.xml);
  }

  const lastTemplateDataRow = templateRowsByNumber.get(config.templateDataEndRow);
  if (!lastTemplateDataRow) {
    throw new Error(`Missing billing template row ${config.templateDataEndRow}`);
  }

  for (let index = 0; index < dataRowCount; index += 1) {
    const rowNumber = config.dataStartRow + index;
    const templateRow =
      templateRowsByNumber.get(rowNumber) ??
      shiftRowXml(lastTemplateDataRow, config.templateDataEndRow, rowNumber);
    outputRows.push(templateRow);
  }

  for (const row of rows) {
    if (row.row > config.templateDataEndRow) {
      outputRows.push(shiftRowXml(row.xml, row.row, row.row + addRows));
    }
  }

  return { addRows, rows: outputRows };
};

const updateDimension = (sheetXml: string, config: TemplateConfig, addRows: number) => {
  const templateEnd = config.trailingDimensionRow ?? config.grandTotalRow;
  const endRow = templateEnd + addRows;
  return sheetXml.replace(
    /<dimension ref="[^"]+"\/>/,
    `<dimension ref="${config.dimensionStartCell}:${config.dimensionColumn}${endRow}"/>`,
  );
};

const updateMergeCells = (
  sheetXml: string,
  config: TemplateConfig,
  addRows: number,
  dataEndRow: number,
) => {
  if (addRows === 0 || !sheetXml.includes("<mergeCells")) return sheetXml;

  const clonedMerges =
    config.clonedMergeColumns?.flatMap(([startColumn, endColumn]) =>
      Array.from({ length: addRows }, (_, index) => {
        const row = config.templateDataEndRow + index + 1;
        return `<mergeCell ref="${startColumn}${row}:${endColumn}${row}"/>`;
      }),
    ) ?? [];

  return sheetXml.replace(
    /<mergeCells count="(\d+)">([\s\S]*?)<\/mergeCells>/,
    (_match, count, body) => {
      const shiftedBody = body.replace(/ref="([^"]+)"/g, (_refMatch: string, ref: string) => {
        const shiftedRef = shiftRangeRef(ref, config.templateDataEndRow, addRows);
        return `ref="${shiftedRef}"`;
      });
      const dataMerges = clonedMerges.filter((merge) => {
        const row = Number(merge.match(/\d+/)?.[0] ?? 0);
        return row <= dataEndRow;
      });
      return `<mergeCells count="${Number(count) + dataMerges.length}">${shiftedBody}${dataMerges.join(
        "",
      )}</mergeCells>`;
    },
  );
};

const updateCoreProperties = (
  createdAt: string,
) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Pratix</dc:creator><cp:lastModifiedBy>Pratix</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified></cp:coreProperties>`;

const populateFeesRows = (
  rows: string[],
  inputRows: BillingExportRow[],
  config: TemplateConfig,
) => {
  const dataEndRow = config.dataStartRow + rows.length - 1;
  const populated = rows.map((rowXml, index) => {
    const rowNumber = config.dataStartRow + index;
    let nextRow = clearDataRow(rowXml, rowNumber, 21);
    const billingRow = inputRows[index];
    if (!billingRow) return nextRow;

    const matchedColumn = matchFeeColumn(billingRow);
    nextRow = setCell(nextRow, rowNumber, 0, (cell) =>
      dateCellFromTemplate(rowNumber, 0, billingRow.activityDate, cell),
    );
    nextRow = setCell(nextRow, rowNumber, 1, (cell) =>
      stringCellFromTemplate(rowNumber, 1, billingRow.clientName, cell),
    );
    nextRow = setCell(nextRow, rowNumber, 2, (cell) =>
      stringCellFromTemplate(rowNumber, 2, counterpartyLabel(billingRow), cell),
    );
    nextRow = setCell(nextRow, rowNumber, matchedColumn.columnIndex, (cell) =>
      numberCellFromTemplate(rowNumber, matchedColumn.columnIndex, billingRow.quantity, cell),
    );

    if (matchedColumn.columnIndex === 15) {
      (billingRow.hearingDates ?? []).slice(0, 2).forEach((date, hearingIndex) => {
        nextRow = setCell(nextRow, rowNumber, 16 + hearingIndex, (cell) =>
          dateCellFromTemplate(rowNumber, 16 + hearingIndex, date, cell),
        );
      });
    }

    return nextRow;
  });

  return { dataEndRow, rows: populated };
};

const populateExpenseRows = (
  rows: string[],
  inputRows: BillingExportRow[],
  config: TemplateConfig,
) => {
  const dataEndRow = config.dataStartRow + rows.length - 1;
  const populated = rows.map((rowXml, index) => {
    const rowNumber = config.dataStartRow + index;
    let nextRow = clearDataRow(rowXml, rowNumber, 10);
    const billingRow = inputRows[index];
    if (!billingRow) return nextRow;

    const matchedColumn = matchExpenseColumn(billingRow);
    nextRow = setCell(nextRow, rowNumber, 1, (cell) =>
      dateCellFromTemplate(rowNumber, 1, billingRow.activityDate, cell),
    );
    nextRow = setCell(nextRow, rowNumber, 2, (cell) =>
      stringCellFromTemplate(rowNumber, 2, billingRow.clientName, cell),
    );
    nextRow = setCell(nextRow, rowNumber, 3, (cell) =>
      stringCellFromTemplate(rowNumber, 3, counterpartyLabel(billingRow), cell),
    );
    nextRow = setCell(nextRow, rowNumber, matchedColumn.columnIndex, (cell) =>
      numberCellFromTemplate(rowNumber, matchedColumn.columnIndex, billingRow.amount, cell),
    );

    return nextRow;
  });

  return { dataEndRow, rows: populated };
};

const updateFeesFormulas = (
  rows: string[],
  inputRows: BillingExportRow[],
  config: TemplateConfig,
  addRows: number,
) => {
  const totalRow = config.totalRow + addRows;
  const grandTotalRow = config.grandTotalRow + addRows;
  const rowAmounts = inputRows.map((row, index) => ({
    row,
    rowNumber: config.dataStartRow + index,
    matchedColumn: matchFeeColumn(row).columnIndex,
  }));
  const formulaForColumn = (column: FeeColumn) => {
    const expressions = rowAmounts.flatMap(({ row, rowNumber, matchedColumn }) => {
      if (matchedColumn !== column.columnIndex) return [];
      return [
        Number.isFinite(row.unitPrice)
          ? `${cellRef(rowNumber, column.columnIndex)}*${excelNumberLiteral(row.unitPrice)}`
          : excelNumberLiteral(row.amount),
      ];
    });

    return expressions.length > 0 ? `SUM(${expressions.join("+")})` : "0";
  };

  return rows.map((rowXml) => {
    if (rowXml.includes(`r="${totalRow}"`)) {
      return feeColumns.reduce(
        (nextRow, column) =>
          setCell(nextRow, totalRow, column.columnIndex, (cell) =>
            formulaCellFromTemplate(totalRow, column.columnIndex, formulaForColumn(column), cell),
          ),
        rowXml,
      );
    }

    if (rowXml.includes(`r="${grandTotalRow}"`)) {
      return setCell(rowXml, grandTotalRow, 3, (cell) =>
        formulaCellFromTemplate(grandTotalRow, 3, `SUM(D${totalRow}:V${totalRow})`, cell),
      );
    }

    return rowXml;
  });
};

const updateExpenseFormulas = (
  rows: string[],
  dataEndRow: number,
  config: TemplateConfig,
  addRows: number,
) => {
  const totalRow = config.totalRow + addRows;
  const grandTotalRow = config.grandTotalRow + addRows;

  return rows.map((rowXml) => {
    if (rowXml.includes(`r="${totalRow}"`)) {
      return expenseColumns.reduce(
        (nextRow, column) =>
          setCell(nextRow, totalRow, column.columnIndex, (cell) =>
            formulaCellFromTemplate(
              totalRow,
              column.columnIndex,
              `SUM(${columnName(column.columnIndex)}${config.dataStartRow}:${columnName(
                column.columnIndex,
              )}${dataEndRow})`,
              cell,
            ),
          ),
        rowXml,
      );
    }

    if (rowXml.includes(`r="${grandTotalRow}"`)) {
      return setCell(rowXml, grandTotalRow, 1, (cell) =>
        formulaCellFromTemplate(grandTotalRow, 1, `SUM(F${totalRow}:K${totalRow})`, cell),
      );
    }

    return rowXml;
  });
};

const buildTemplateWorksheet = (
  input: BillingWorkbookInput,
  sheetXml: string,
  config: TemplateConfig,
) => {
  const dataRowCount = Math.max(input.rows.length, templateDataRows(config));
  const { addRows, rows } = buildTemplateRows(sheetXml, config, dataRowCount);
  const dataRows = rows.filter((rowXml) => {
    const row = Number(rowXml.match(/\br="(\d+)"/)?.[1] ?? 0);
    return row >= config.dataStartRow && row < config.dataStartRow + dataRowCount;
  });
  const nonDataRows = rows.filter((rowXml) => {
    const row = Number(rowXml.match(/\br="(\d+)"/)?.[1] ?? 0);
    return row < config.dataStartRow || row >= config.dataStartRow + dataRowCount;
  });
  const populated =
    input.kind === "fees"
      ? populateFeesRows(dataRows, input.rows, config)
      : populateExpenseRows(dataRows, input.rows, config);
  const formulaRows =
    input.kind === "fees"
      ? updateFeesFormulas(nonDataRows, input.rows, config, addRows)
      : updateExpenseFormulas(nonDataRows, populated.dataEndRow, config, addRows);
  const nextRows = [...formulaRows, ...populated.rows].sort((left, right) => {
    const leftRow = Number(left.match(/\br="(\d+)"/)?.[1] ?? 0);
    const rightRow = Number(right.match(/\br="(\d+)"/)?.[1] ?? 0);
    return leftRow - rightRow;
  });

  return updateMergeCells(
    updateDimension(
      sheetXml.replace(
        /<sheetData>[\s\S]*?<\/sheetData>/,
        `<sheetData>${nextRows.join("")}</sheetData>`,
      ),
      config,
      addRows,
    ),
    config,
    addRows,
    populated.dataEndRow,
  );
};

export function buildBillingWorkbook(input: BillingWorkbookInput): BillingWorkbookFile {
  const config = templateConfigs[input.kind];
  const fileName = `${config.kindName}-${safeFileSegment(input.principalName)}-${input.periodStart}-${input.periodEnd}.xlsx`;
  const createdAt = new Date().toISOString();
  const files = unzipSync(base64ToBytes(config.templateBase64));

  files["docProps/core.xml"] = strToU8(updateCoreProperties(createdAt));
  files["xl/worksheets/sheet1.xml"] = strToU8(
    buildTemplateWorksheet(input, strFromU8(files["xl/worksheets/sheet1.xml"]), config),
  );

  return {
    bytes: zipSync(files),
    fileName,
    mimeType: MIME_XLSX,
  };
}
