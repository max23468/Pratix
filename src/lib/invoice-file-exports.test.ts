// @vitest-environment jsdom

import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import {
  invoicePdfBytes,
  invoicePdfFileName,
  invoiceXmlBytes,
  archiveBytes,
  downloadBytes,
  safeArchiveSegment,
} from "./invoice-file-exports";
import type { InvoicePdfData } from "./invoice-pdf";

const invoiceData = (): InvoicePdfData => ({
  invoice: {
    number: "12/A",
    year: 2026,
    issue_date: "2026-05-09",
    due_date: "2026-06-09",
    notes: null,
    taxable_fees: 100,
    taxable_expenses: 0,
    art15_expenses: 12.5,
    general_expenses_amount: 10,
    cassa_amount: 4.4,
    vat_amount: 25.17,
    withholding_amount: 22,
    stamp_amount: 2,
    total_amount: 154.07,
    net_to_pay: 132.07,
    cassa_rate: 4,
    vat_rate: 22,
    withholding_rate: 20,
    apply_withholding: true,
  },
  lines: [
    {
      kind: "fee",
      description: "Accesso in cancelleria",
      quantity: 1,
      unit_price: 100,
      amount: 100,
    },
  ],
  client: {
    kind: "company",
    business_name: "Committente Test",
    vat_number: "12345678901",
    address_city: "Roma",
  },
  profile: {
    full_name: "Avv. Test",
    vat_number: "10987654321",
    tax_regime: "ordinario",
  },
});

describe("invoice file exports", () => {
  it("normalizza segmenti e nomi file", () => {
    expect(safeArchiveSegment(" Fattura / 12\\A € ")).toBe("Fattura-12-A");
    expect(invoicePdfFileName(invoiceData().invoice)).toBe("Fattura_2026_12-A.pdf");
  });

  it("genera bytes separati per PDF e XML", () => {
    expect(invoicePdfBytes(invoiceData()).length).toBeGreaterThan(1000);
    expect(strFromU8(invoiceXmlBytes("<FatturaElettronica />"))).toBe("<FatturaElettronica />");
  });

  it("impacchetta export multipli in un archivio ZIP con nomi sicuri", () => {
    const archive = unzipSync(
      archiveBytes([
        { fileName: "Fattura/12.xml", bytes: invoiceXmlBytes("<xml />") },
        { fileName: "Fattura 13.pdf", bytes: new Uint8Array([1, 2, 3]) },
      ]),
    );

    expect(strFromU8(archive["Fattura-12.xml"])).toBe("<xml />");
    expect(Array.from(archive["Fattura-13.pdf"])).toEqual([1, 2, 3]);
  });

  it("scarica bytes tramite link temporaneo e revoca l'URL creato", () => {
    const createObjectURL = vi.fn(() => "blob:invoice-export");
    const revokeObjectURL = vi.fn();
    const anchorClick = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      value: anchorClick,
    });

    downloadBytes({
      bytes: new Uint8Array([1, 2, 3]),
      fileName: "fattura.xml",
      mimeType: "application/xml",
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:invoice-export");
  });
});
