import { describe, expect, it } from "vitest";

import { buildInvoiceXml, type InvoiceXmlData } from "./invoice-xml";

const baseInvoice: InvoiceXmlData = {
  invoice: {
    number: "12/2026",
    year: 2026,
    issue_date: "2026-05-09",
    due_date: "2026-06-09",
    payment_method: "Bonifico",
    cassa_rate: 4,
    vat_rate: 22,
    withholding_rate: 20,
    apply_withholding: true,
    taxable_fees: 1000,
    taxable_expenses: 0,
    art15_expenses: 80,
    general_expenses_amount: 100,
    cassa_base_amount: 1100,
    cassa_amount: 44,
    vat_amount: 251.68,
    withholding_amount: 220,
    stamp_amount: 2,
    total_amount: 1477.68,
  },
  lines: [
    {
      kind: "fee",
      description: "Accesso & deposito <atto>",
      quantity: 2,
      unit_price: 500,
      amount: 1000,
    },
    {
      kind: "expense_art15",
      description: "Costo notifica",
      quantity: 1,
      unit_price: 80,
      amount: 80,
    },
  ],
  client: {
    kind: "company",
    business_name: "Cliente & Figli <Srl>",
    vat_number: "09876543210",
    tax_code: null,
    sdi_code: "",
    pec: "cliente@example.test",
    address_street: "Via Roma 1",
    address_zip: "00100",
    address_city: "Roma",
    address_province: "RM",
    address_country: "IT",
  },
  profile: {
    business_name: "Avv. Pratix & Partners",
    full_name: "Avvocato Test",
    vat_number: "12345678901",
    tax_code: "TSTVVC80A01H501U",
    address_street: "Via Milano 2",
    address_zip: "20100",
    address_city: "Milano",
    address_province: "MI",
    address_country: "IT",
    tax_regime: "ordinario",
  },
};

describe("buildInvoiceXml", () => {
  it("genera una parcella TD06 ordinaria con cassa, ritenuta, bollo, Art. 15 ed escaping XML", () => {
    const { xml, filename } = buildInvoiceXml(baseInvoice);

    expect(filename).toBe("IT12345678901_2026122026.xml");
    expect(xml).toContain('versione="FPR12"');
    expect(xml).toContain("<TipoDocumento>TD06</TipoDocumento>");
    expect(xml).toContain("<RegimeFiscale>RF01</RegimeFiscale>");
    expect(xml).toContain("<Denominazione>Avv. Pratix &amp; Partners</Denominazione>");
    expect(xml).toContain("<Denominazione>Cliente &amp; Figli &lt;Srl&gt;</Denominazione>");
    expect(xml).toContain("<Descrizione>Accesso &amp; deposito &lt;atto&gt;</Descrizione>");
    expect(xml).toContain("<TipoCassa>TC07</TipoCassa>");
    expect(xml).toContain("<ImportoRitenuta>220.00</ImportoRitenuta>");
    expect(xml).toContain("<BolloVirtuale>SI</BolloVirtuale>");
    expect(xml).toContain("<Natura>N1</Natura>");
    expect(xml).toContain("<ImportoPagamento>1257.68</ImportoPagamento>");
  });

  it("genera regime forfettario con cassa, senza IVA e ritenuta e con Natura N2.2", () => {
    const { xml } = buildInvoiceXml({
      ...baseInvoice,
      invoice: {
        ...baseInvoice.invoice,
        cassa_base_amount: 100,
        cassa_amount: 4,
        vat_amount: 0,
        withholding_amount: 0,
        stamp_amount: 2,
        total_amount: 106,
      },
      lines: [
        {
          kind: "fee",
          description: "Compenso forfettario",
          quantity: 1,
          unit_price: 100,
          amount: 100,
        },
      ],
      profile: {
        ...baseInvoice.profile,
        tax_regime: "forfettario",
      },
    });

    expect(xml).toContain("<RegimeFiscale>RF19</RegimeFiscale>");
    expect(xml).toContain("<AliquotaIVA>0.00</AliquotaIVA>");
    expect(xml).toContain("<Natura>N2.2</Natura>");
    expect(xml).toContain("<DatiCassaPrevidenziale>");
    expect(xml).toContain("<ImportoContributoCassa>4.00</ImportoContributoCassa>");
    expect(xml).not.toContain("<DatiRitenuta>");
    expect(xml).toContain("<ImportoPagamento>106.00</ImportoPagamento>");
  });

  it("blocca XML senza Partita IVA del professionista", () => {
    expect(() =>
      buildInvoiceXml({
        ...baseInvoice,
        profile: {
          ...baseInvoice.profile,
          vat_number: "",
        },
      }),
    ).toThrow("Partita IVA mancante");
  });

  it("blocca XML senza identificativo fiscale del committente", () => {
    expect(() =>
      buildInvoiceXml({
        ...baseInvoice,
        client: {
          ...baseInvoice.client,
          vat_number: "",
          tax_code: "",
        },
      }),
    ).toThrow("Committente senza P.IVA né Codice Fiscale");
  });
});
