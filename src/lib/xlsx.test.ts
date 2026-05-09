import { strToU8, zipSync } from "fflate";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

import { parseFirstXlsxSheet } from "./xlsx";

beforeAll(() => {
  globalThis.DOMParser = new JSDOM().window.DOMParser;
});

const fileFromArchive = (archive: Record<string, string>, name = "archivio.xlsx") => {
  const bytes = zipSync(
    Object.fromEntries(Object.entries(archive).map(([path, content]) => [path, strToU8(content)])),
  );
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return {
    name,
    arrayBuffer: async () => body,
  } as File;
};

describe("parseFirstXlsxSheet", () => {
  it("legge intestazioni, shared strings, inline strings e celle numeriche", async () => {
    const file = fileFromArchive({
      "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <si><t>Cliente</t></si>
          <si><t>Importo</t></si>
          <si><t>Ada Rossi</t></si>
          <si><t>Beta S.p.A.</t></si>
        </sst>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1">
              <c r="A1" t="s"><v>0</v></c>
              <c r="B1" t="s"><v>1</v></c>
              <c r="D1" t="inlineStr"><is><t>Note</t></is></c>
            </row>
            <row r="2">
              <c r="A2" t="s"><v>2</v></c>
              <c r="B2"><v>1200.50</v></c>
              <c r="D2" t="inlineStr"><is><t>Da fatturare</t></is></c>
            </row>
            <row r="3">
              <c r="A3" t="s"><v>3</v></c>
              <c r="B3"><v>0</v></c>
            </row>
            <row r="4">
              <c r="A4"><v>   </v></c>
            </row>
          </sheetData>
        </worksheet>`,
    });

    await expect(parseFirstXlsxSheet(file)).resolves.toEqual({
      headers: ["Cliente", "Importo", "", "Note"],
      rows: [
        ["Ada Rossi", "1200.50", "", "Da fatturare"],
        ["Beta S.p.A.", "0"],
      ],
    });
  });

  it("usa il primo foglio ordinato quando sheet1 non esiste", async () => {
    const file = fileFromArchive({
      "xl/worksheets/sheet2.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData><row><c r="A1"><v>Intestazione</v></c></row></sheetData>
        </worksheet>`,
      "xl/worksheets/sheet10.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData><row><c r="A1"><v>Secondario</v></c></row></sheetData>
        </worksheet>`,
    });

    await expect(parseFirstXlsxSheet(file)).resolves.toEqual({
      headers: ["Secondario"],
      rows: [],
    });
  });

  it("rifiuta file non xlsx, archivi senza fogli e XML non valido", async () => {
    await expect(
      parseFirstXlsxSheet({
        name: "archivio.xls",
        arrayBuffer: async () => new ArrayBuffer(0),
      } as File),
    ).rejects.toThrow("Carica un file .xlsx");

    await expect(parseFirstXlsxSheet(fileFromArchive({}))).rejects.toThrow(
      "Il file Excel non contiene fogli leggibili",
    );

    await expect(
      parseFirstXlsxSheet(
        fileFromArchive({
          "xl/worksheets/sheet1.xml": "<worksheet><sheetData>",
        }),
      ),
    ).rejects.toThrow("Il file Excel contiene XML non valido");
  });
});
