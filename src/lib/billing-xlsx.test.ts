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
  it("genera un rendiconto compensi con sheet, filename, header e celle attese", () => {
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
          description: "Accesso agli atti & verifica <documenti>",
          quantity: 2,
          unitPrice: 25,
          amount: 50,
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
    expect(workbookXml).toContain("<bookViews>");
    expect(worksheetXml).toContain("Rendiconto compensi");
    expect(worksheetXml).toContain('<dimension ref="A1:I5"/>');
    expect(worksheetXml).toContain("Prezzo unitario");
    expect(worksheetXml).toContain("2026-01-20, 2026-01-27");
    expect(worksheetXml).toContain("Accesso agli atti &amp; verifica &lt;documenti&gt;");
    expect(worksheetXml).toContain('<c r="G5"><v>2</v></c>');
    expect(worksheetXml).toContain('<c r="H5"><v>25</v></c>');
    expect(worksheetXml).toContain('<c r="I5"><v>50</v></c>');
    expect(stylesXml).toContain('<fills count="2">');
  });

  it("genera un rendiconto rimborsi spese con fallback filename e colonne ridotte", () => {
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
          description: "Contributo unificato",
          quantity: 1,
          unitPrice: 0,
          amount: 118.5,
        },
      ],
    });

    expect(file.fileName).toBe("rimborsi-spese-committente-2026-02-01-2026-02-28.xlsx");
    expect(workbookXml).toContain('sheet name="Rimborsi"');
    expect(worksheetXml).toContain("Rendiconto rimborsi spese");
    expect(worksheetXml).toContain("Importo");
    expect(worksheetXml).not.toContain("Prezzo unitario");
    expect(worksheetXml).toContain('<c r="F5"><v>1</v></c>');
    expect(worksheetXml).toContain('<c r="G5"><v>118.5</v></c>');
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
