import { describe, expect, it } from "vitest";

import {
  buildActivityAttachmentStoragePath,
  buildBillingExportStoragePath,
  buildInvoiceStoragePath,
  buildPratixStoragePath,
  PRATIX_STORAGE_AREAS,
} from "./storage-paths";

describe("storage paths", () => {
  it("normalizza segmenti utente, owner e nome file senza cambiare l'area", () => {
    expect(
      buildPratixStoragePath({
        userId: " user/1 ",
        area: PRATIX_STORAGE_AREAS.invoices,
        ownerRecordId: " inv\\12 ",
        fileName: " Fattura / maggio.pdf ",
      }),
    ).toBe("user-1/invoices/inv-12/Fattura - maggio.pdf");
  });

  it("usa fallback file per nomi vuoti", () => {
    expect(
      buildPratixStoragePath({
        userId: "user-1",
        area: PRATIX_STORAGE_AREAS.imports,
        fileName: "   ",
      }),
    ).toBe("user-1/imports/file");
  });

  it("costruisce path stabili per fatture, allegati attività e rendiconti", () => {
    expect(buildInvoiceStoragePath("u1", "invoice-1", "fattura.xml")).toBe(
      "u1/invoices/invoice-1/fattura.xml",
    );
    expect(buildActivityAttachmentStoragePath("u1", "activity-1", "ricevuta.pdf")).toBe(
      "u1/activities/activity-1/ricevuta.pdf",
    );
    expect(buildBillingExportStoragePath("u1", "run-1", "rendiconto.xlsx")).toBe(
      "u1/billing-exports/run-1/rendiconto.xlsx",
    );
  });
});
