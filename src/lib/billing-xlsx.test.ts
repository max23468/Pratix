import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { buildBillingWorkbook, type BillingWorkbookInput } from "./billing-xlsx";

const readWorkbookParts = (input: BillingWorkbookInput) => {
  const file = buildBillingWorkbook(input);
  const archive = unzipSync(file.bytes);

  return {
    file,
    contentTypesXml: strFromU8(archive["[Content_Types].xml"]),
    appPropsXml: strFromU8(archive["docProps/app.xml"]),
    corePropsXml: strFromU8(archive["docProps/core.xml"]),
    workbookXml: strFromU8(archive["xl/workbook.xml"]),
    worksheetXml: strFromU8(archive["xl/worksheets/sheet1.xml"]),
    stylesXml: strFromU8(archive["xl/styles.xml"]),
  };
};

describe("buildBillingWorkbook", () => {
  it("genera un rendiconto compensi con matrice larga allineata al template", () => {
    const {
      file,
      contentTypesXml,
      appPropsXml,
      corePropsXml,
      workbookXml,
      worksheetXml,
      stylesXml,
    } = readWorkbookParts({
      kind: "fees",
      principalName: "Comune di Roma & Area <Legale>",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      rows: [
        {
          practiceNumber: 42,
          clientName: "Ada Rossi",
          counterpartyName: "Beta S.p.A.",
          activityDate: "2026-01-15",
          description:
            "Procedimenti ordinari, mediazione, esecutivi, concorsuali: udienza sostenuta",
          quantity: 2,
          unitPrice: 40,
          amount: 80,
          hearingDates: ["2026-01-20", "2026-01-27"],
        },
      ],
    });

    expect(file).toMatchObject({
      fileName: "compensi-Comune-di-Roma-Area-Legale-2026-01-01-2026-01-31.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(file.bytes.length).toBeGreaterThan(1000);
    expect(contentTypesXml).toContain("/docProps/core.xml");
    expect(appPropsXml).toContain("<Application>Pratix</Application>");
    expect(corePropsXml).toContain("<dc:creator>Pratix</dc:creator>");
    expect(workbookXml).toContain('sheet name="Compensi"');
    expect(worksheetXml).toContain('<dimension ref="A1:U9"/>');
    expect(worksheetXml).toContain("ATTENZIONE: IL FOGLIO CONTIENE FORMULE");
    expect(worksheetXml).toContain("DATA ATTIVITÀ");
    expect(worksheetXml).toContain("NDG-DENOMINAZIONE");
    expect(worksheetXml).toContain("Procedimenti ordinari / mediazione / esecutivi / concorsuali");
    expect(worksheetXml).toContain("Data udienza");
    expect(worksheetXml).toContain("42 - Beta S.p.A.");
    expect(worksheetXml).toContain('<c r="P5" s="6"><v>2</v></c>');
    expect(worksheetXml).toContain('<c r="Q5" s="5"><v>');
    expect(worksheetXml).toContain("<f>SUM(P5:P5)*40</f>");
    expect(worksheetXml).toContain("<f>SUM(D7:P7,S7:U7)</f>");
    expect(stylesXml).toContain('<fills count="5">');
  });

  it("genera un rendiconto rimborsi spese con colonne del template B:K", () => {
    const { file, workbookXml, worksheetXml } = readWorkbookParts({
      kind: "expenses",
      principalName: "   ",
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      rows: [
        {
          practiceNumber: null,
          clientName: "Cliente",
          counterpartyName: "Controparte",
          activityDate: "2026-02-10",
          description: "Costo notifica precetto",
          quantity: 1,
          unitPrice: 0,
          amount: 118.5,
        },
      ],
    });

    expect(file.fileName).toBe("rimborsi-spese-committente-2026-02-01-2026-02-28.xlsx");
    expect(workbookXml).toContain('sheet name="Spese"');
    expect(worksheetXml).toContain('<dimension ref="B1:K4"/>');
    expect(worksheetXml).toContain("DATA SPESA");
    expect(worksheetXml).toContain("COSTO NOTIFICA PRECETTO");
    expect(worksheetXml).toContain("EVENTUALE IMPORTO DEL CONGUAGLIO");
    expect(worksheetXml).not.toContain("Prezzo unitario");
    expect(worksheetXml).toContain('<c r="G2" s="7"><v>118.5</v></c>');
    expect(worksheetXml).toContain("<f>SUM(G2:G2)</f>");
  });

  it("mappa le voci compenso 12 mesi sulle colonne dedicate", () => {
    const { worksheetXml } = readWorkbookParts({
      kind: "fees",
      principalName: "Committente",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      rows: [
        {
          practiceNumber: 1,
          clientName: "Cliente",
          counterpartyName: "Controparte",
          activityDate: "2026-01-10",
          description:
            "Pignoramento immobiliare diretto, decorrenza 12 mesi dall'udienza ex art. 569 c.p.c.",
          quantity: 1,
          unitPrice: 150,
          amount: 150,
        },
        {
          practiceNumber: 2,
          clientName: "Cliente",
          counterpartyName: "Controparte",
          activityDate: "2026-01-11",
          description:
            "Intervento in procedura esecutiva immobiliare, decorrenza 12 mesi dal deposito",
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        },
      ],
    });

    expect(worksheetXml).toContain('<c r="J5" s="6"><v>1</v></c>');
    expect(worksheetXml).toContain('<c r="M6" s="6"><v>1</v></c>');
  });

  it("mantiene compatto il nome file dei rendiconti con committenti lunghi", () => {
    const { file } = readWorkbookParts({
      kind: "expenses",
      principalName: "Committente con denominazione molto lunga e area legale recupero crediti",
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
      rows: [],
    });

    expect(file.fileName).toBe(
      "rimborsi-spese-Committente-con-denominazione-molto-lung-2026-04-01-2026-06-30.xlsx",
    );
    expect(file.fileName.length).toBeLessThanOrEqual(90);
  });
});
