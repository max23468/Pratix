import { describe, expect, it } from "vitest";

import { computeInvoice } from "./invoice-calc";

const ordinaryOptions = {
  cassaRate: 4,
  vatRate: 22,
  withholdingRate: 20,
  applyWithholding: true,
  taxRegime: "ordinario" as const,
};

describe("computeInvoice", () => {
  it("calcola compensi, spese generali, cassa, IVA, ritenuta, Art. 15 e bollo in regime ordinario", () => {
    expect(
      computeInvoice(
        [
          { kind: "fee", quantity: 2, unit_price: 500 },
          { kind: "expense_art15", quantity: 1, unit_price: 80 },
        ],
        {
          ...ordinaryOptions,
          includeGeneralExpenses: true,
          generalExpensesRate: 10,
          includeStampDuty: true,
        },
      ),
    ).toEqual({
      taxableFees: 1000,
      art15Expenses: 80,
      generalExpensesAmount: 100,
      cassaBaseAmount: 1100,
      cassaAmount: 44,
      vatBase: 1144,
      vatAmount: 251.68,
      withholdingBase: 1100,
      withholdingAmount: 220,
      stampAmount: 2,
      totalAmount: 1477.68,
      netToPay: 1257.68,
    });
  });

  it("applica la cassa e non applica IVA e ritenuta in regime forfettario", () => {
    const result = computeInvoice([{ kind: "fee", quantity: 1, unit_price: 100 }], {
      cassaRate: 4,
      vatRate: 22,
      withholdingRate: 20,
      applyWithholding: true,
      taxRegime: "forfettario",
      includeStampDuty: true,
    });

    expect(result).toMatchObject({
      taxableFees: 100,
      cassaBaseAmount: 100,
      cassaAmount: 4,
      vatAmount: 0,
      withholdingBase: 0,
      withholdingAmount: 0,
      stampAmount: 2,
      totalAmount: 106,
      netToPay: 106,
    });
  });

  it("arrotonda ogni riga a due decimali prima dei totali", () => {
    const result = computeInvoice([{ kind: "fee", quantity: 3, unit_price: 33.335 }], {
      ...ordinaryOptions,
      applyWithholding: false,
    });

    expect(result.taxableFees).toBe(100.01);
    expect(result.totalAmount).toBe(126.89);
  });

  it("non applica il bollo quando la preferenza è disattiva", () => {
    const result = computeInvoice(
      [
        { kind: "fee", quantity: 1, unit_price: 100 },
        { kind: "expense_art15", quantity: 1, unit_price: 100 },
      ],
      {
        ...ordinaryOptions,
        includeStampDuty: false,
      },
    );

    expect(result.stampAmount).toBe(0);
    expect(result.totalAmount).toBe(226.88);
  });

  it("applica la soglia forfettaria al totale con cassa", () => {
    const result = computeInvoice([{ kind: "fee", quantity: 1, unit_price: 75 }], {
      cassaRate: 4,
      vatRate: 22,
      withholdingRate: 20,
      applyWithholding: false,
      taxRegime: "forfettario",
      includeStampDuty: true,
    });

    expect(result.cassaAmount).toBe(3);
    expect(result.stampAmount).toBe(2);
    expect(result.totalAmount).toBe(80);
  });
});
