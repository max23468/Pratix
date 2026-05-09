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
        },
      ),
    ).toEqual({
      taxableFees: 1000,
      taxableExpenses: 0,
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

  it("non applica IVA, cassa e ritenuta in regime forfettario e applica il bollo oltre soglia", () => {
    const result = computeInvoice([{ kind: "fee", quantity: 1, unit_price: 100 }], {
      cassaRate: 4,
      vatRate: 22,
      withholdingRate: 20,
      applyWithholding: true,
      taxRegime: "forfettario",
    });

    expect(result).toMatchObject({
      taxableFees: 100,
      cassaAmount: 0,
      vatAmount: 0,
      withholdingBase: 0,
      withholdingAmount: 0,
      stampAmount: 2,
      totalAmount: 102,
      netToPay: 102,
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
});
