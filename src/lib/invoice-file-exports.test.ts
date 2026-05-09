import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  buildInvoiceArchive,
  buildInvoiceArchiveFileName,
  buildSingleInvoiceFiles,
  invoicePdfFileName,
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
  it("normalizza segmenti e nomi file per archivio", () => {
    expect(safeArchiveSegment(" Fattura / 12\\A € ")).toBe("Fattura-12-A");
    expect(invoicePdfFileName(invoiceData().invoice)).toBe("Fattura_2026_12-A.pdf");
    expect(
      buildInvoiceArchiveFileName({ periodStart: "2026-05-01", periodEnd: "2026-05-31" }),
    ).toBe("fatture-pratix-2026-05-01_2026-05-31.zip");
  });

  it("genera un archivio con PDF e XML per fattura", () => {
    const files = buildSingleInvoiceFiles({
      invoice: invoiceData(),
      xml: { filename: "IT123_00001.xml", xml: "<FatturaElettronica />" },
    });

    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("fattura-2026-12-A/Fattura_2026_12-A.pdf");
    expect(files[0].bytes.length).toBeGreaterThan(1000);

    const archive = unzipSync(buildInvoiceArchive(files).bytes);
    expect(Object.keys(archive).sort()).toEqual([
      "fattura-2026-12-A/Fattura_2026_12-A.pdf",
      "fattura-2026-12-A/IT123_00001.xml",
    ]);
    expect(strFromU8(archive["fattura-2026-12-A/IT123_00001.xml"])).toBe("<FatturaElettronica />");
  });
});
