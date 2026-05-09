import { describe, expect, it } from "vitest";

import { generateInvoicePdf, type InvoicePdfData } from "./invoice-pdf";

const baseInvoicePdfData = (overrides: Partial<InvoicePdfData> = {}): InvoicePdfData => ({
  invoice: {
    number: "12/A",
    year: 2026,
    issue_date: "2026-05-09",
    due_date: "2026-05-31",
    notes: "Pagamento concordato con il committente.",
    taxable_fees: 1200,
    taxable_expenses: 80,
    art15_expenses: 118.5,
    general_expenses_amount: 120,
    cassa_amount: 52.8,
    vat_amount: 319.62,
    withholding_amount: 264,
    stamp_amount: 2,
    total_amount: 1892.92,
    net_to_pay: 1628.92,
    cassa_rate: 4,
    vat_rate: 22,
    withholding_rate: 20,
    apply_withholding: true,
  },
  lines: [
    {
      kind: "fee",
      description: "Redazione diffida e gestione pratica",
      quantity: 2,
      unit_price: 600,
      amount: 1200,
    },
    {
      kind: "expense_taxable",
      description: "Spesa imponibile",
      quantity: 1,
      unit_price: 80,
      amount: 80,
    },
    {
      kind: "expense_art15",
      description: "Rimborso spese anticipate",
      quantity: 1,
      unit_price: 118.5,
      amount: 118.5,
    },
  ],
  client: {
    kind: "company",
    business_name: "Alfa S.r.l.",
    tax_code: "01234567890",
    vat_number: "01234567890",
    address_street: "Via Roma 1",
    address_zip: "00100",
    address_city: "Roma",
    address_province: "RM",
  },
  profile: {
    business_name: "Avv. Ada Rossi",
    full_name: "Ada Rossi",
    vat_number: "09876543210",
    tax_code: "RSSDAA80A01H501U",
    address_street: "Via Milano 2",
    address_zip: "20100",
    address_city: "Milano",
    address_province: "MI",
    pec: "ada.rossi@example.test",
    email: "studio@example.test",
    phone: "+3902000000",
    bar_association: "Milano",
    iban: "IT60X0542811101000000123456",
    bank_name: "Banca Test",
    tax_regime: "ordinario",
  },
  ...overrides,
});

describe("generateInvoicePdf", () => {
  it("genera una fattura di cortesia con intestazione, righe, riepilogo e pagamento", () => {
    const doc = generateInvoicePdf(baseInvoicePdfData());
    const pdf = Buffer.from(doc.output("arraybuffer")).toString("latin1");

    expect(doc.getNumberOfPages()).toBe(1);
    expect(pdf).toContain("Avv. Ada Rossi");
    expect(pdf).toContain("Alfa S.r.l.");
    expect(pdf).toContain("FATTURA");
    expect(pdf).toContain("Totale documento");
    expect(pdf).toContain("Netto a pagare");
    expect(pdf).toContain("Coordinate per il pagamento");
  });

  it("usa fallback professionista, omette sezioni vuote e riporta nota forfettario", () => {
    const doc = generateInvoicePdf(
      baseInvoicePdfData({
        invoice: {
          ...baseInvoicePdfData().invoice,
          due_date: null,
          taxable_expenses: 0,
          art15_expenses: 0,
          general_expenses_amount: 0,
          cassa_amount: 0,
          vat_amount: 0,
          withholding_amount: 0,
          stamp_amount: 0,
          notes: null,
        },
        client: {
          kind: "individual",
          first_name: "Luca",
          last_name: "Bianchi",
        },
        profile: {
          tax_regime: "forfettario",
        },
      }),
    );
    const pdf = Buffer.from(doc.output("arraybuffer")).toString("latin1");

    expect(pdf).toContain("Avvocato");
    expect(pdf).toContain("Luca Bianchi");
    expect(pdf).toContain("regime forfettario");
    expect(pdf).not.toContain("Scadenza:");
    expect(pdf).not.toContain("Ritenuta d");
  });

  it("aggiunge pagine quando le righe superano lo spazio disponibile", () => {
    const doc = generateInvoicePdf(
      baseInvoicePdfData({
        lines: Array.from({ length: 70 }, (_, index) => ({
          kind: "fee",
          description: `Attivita numero ${index + 1}`,
          quantity: 1,
          unit_price: 10,
          amount: 10,
        })),
      }),
    );

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
