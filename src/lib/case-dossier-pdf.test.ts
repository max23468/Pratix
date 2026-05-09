import { describe, expect, it } from "vitest";
import { caseDossierPdfFileName, generateCaseDossierPdf } from "@/lib/case-dossier-pdf";

describe("case dossier PDF", () => {
  it("genera un PDF per il dossier pratica", () => {
    const doc = generateCaseDossierPdf({
      practiceNumber: 42,
      title: "Recupero credito Beta",
      status: "In corso",
      openedAt: "2026-05-09",
      principalName: "Alfa S.r.l.",
      clientName: "Ada Rossi",
      counterpartyName: "Beta S.p.A.",
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
      history: [],
      transfers: [],
    });

    expect(caseDossierPdfFileName({ practiceNumber: 42 })).toBe("dossier-pratica-42.pdf");
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });
});
