import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildCaseDossierWorkbook } from "./case-dossier-xlsx";

describe("buildCaseDossierWorkbook", () => {
  it("genera un workbook Excel con riepilogo pratica, attività e fatture", () => {
    const workbook = buildCaseDossierWorkbook({
      practiceNumber: 42,
      title: "Recupero credito Beta",
      status: "In corso",
      openedAt: "2026-05-09",
      principalName: "Alfa S.r.l.",
      clientName: "Ada Rossi",
      counterpartyName: "Beta S.p.A.",
      authority: "Tribunale",
      rgNumber: "123/2026",
      notes: "Nota interna",
      activities: [
        {
          activityDate: "2026-05-10",
          kind: "Compenso",
          status: "Da fatturare",
          description: "Udienza",
          quantity: 1,
          unitPrice: 120,
          amount: 120,
          hearingDates: ["2026-05-10"],
          attachmentNames: ["Verbale.pdf"],
        },
      ],
      invoices: [
        {
          issueDate: "2026-05-11",
          number: "TST1",
          year: 2026,
          status: "Bozza",
          totalAmount: 150,
        },
      ],
      history: [
        {
          changedAt: "2026-05-12",
          previousStatus: "Aperta",
          newStatus: "In corso",
        },
      ],
      transfers: [
        {
          transferredAt: "2026-05-13",
          previousClientName: "Cliente originario",
          newClientName: "Cliente corrente",
        },
      ],
    });

    const files = unzipSync(workbook.bytes);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);

    expect(workbook.fileName).toBe("dossier-pratica-42.xlsx");
    expect(workbook.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(sheet).toContain("Dossier pratica");
    expect(sheet).toContain("Pratica 42");
    expect(sheet).not.toContain("Recupero credito Beta");
    expect(sheet).toContain("Alfa S.r.l.");
    expect(sheet).toContain("Udienza");
    expect(sheet).toContain("Verbale.pdf");
    expect(sheet).toContain("Fattura TST1/2026");
    expect(sheet).toContain("Cliente originario");
  });
});
