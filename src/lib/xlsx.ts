import { strFromU8, unzipSync } from "fflate";

export type XlsxSheet = {
  headers: string[];
  rows: string[][];
};

export async function parseFirstXlsxSheet(file: File): Promise<XlsxSheet> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Carica un file .xlsx. Il formato .xls non è supportato.");
  }

  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const sharedStrings = parseSharedStrings(readZipText(archive, "xl/sharedStrings.xml", false));
  const sheetPath = findFirstSheetPath(archive);
  const sheetXml = readZipText(archive, sheetPath, true);
  const rows = parseSheetRows(sheetXml, sharedStrings);
  const [headers = [], ...body] = rows;

  return {
    headers: headers.map((header) => header.trim()),
    rows: body.filter((row) => row.some((cell) => cell.trim())),
  };
}

function findFirstSheetPath(archive: Record<string, Uint8Array>) {
  if (archive["xl/worksheets/sheet1.xml"]) return "xl/worksheets/sheet1.xml";

  const firstSheet = Object.keys(archive)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
    .sort()[0];

  if (!firstSheet) throw new Error("Il file Excel non contiene fogli leggibili.");
  return firstSheet;
}

function readZipText(archive: Record<string, Uint8Array>, path: string, required: boolean) {
  const entry = archive[path];
  if (!entry) {
    if (required) throw new Error(`File Excel non valido: manca ${path}.`);
    return "";
  }
  return strFromU8(entry);
}

function parseSharedStrings(xml: string) {
  if (!xml) return [];
  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagNameNS("*", "si")).map((node) =>
    Array.from(node.getElementsByTagNameNS("*", "t"))
      .map((textNode) => textNode.textContent ?? "")
      .join(""),
  );
}

function parseSheetRows(xml: string, sharedStrings: string[]) {
  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagNameNS("*", "row")).map((rowNode) => {
    const values: string[] = [];
    Array.from(rowNode.getElementsByTagNameNS("*", "c")).forEach((cellNode) => {
      const ref = cellNode.getAttribute("r") ?? "";
      const index = columnIndex(ref.replace(/\d+/g, ""));
      if (index < 0) return;
      values[index] = readCellValue(cellNode, sharedStrings);
    });
    return values.map((value) => value ?? "");
  });
}

function readCellValue(cellNode: Element, sharedStrings: string[]) {
  const type = cellNode.getAttribute("t");
  if (type === "inlineStr") {
    return Array.from(cellNode.getElementsByTagNameNS("*", "t"))
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
  }

  const rawValue = cellNode.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
  if (type === "s") return (sharedStrings[Number(rawValue)] ?? "").trim();
  return rawValue.trim();
}

function parseXml(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const error = doc.getElementsByTagName("parsererror")[0];
  if (error) throw new Error("Il file Excel contiene XML non valido.");
  return doc;
}

function columnIndex(columnRef: string) {
  if (!columnRef) return -1;
  return (
    columnRef
      .toUpperCase()
      .split("")
      .reduce((index, char) => index * 26 + char.charCodeAt(0) - 64, 0) - 1
  );
}
