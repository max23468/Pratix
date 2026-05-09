import { describe, expect, it } from "vitest";

import {
  commonPriceTemplateItems,
  commonPriceTemplateYears,
  createTemplateItems,
  defaultValidFrom,
  defaultValidTo,
} from "./price-templates";

describe("price templates", () => {
  it("mantiene gli anni template attesi per il recupero crediti", () => {
    expect(commonPriceTemplateYears).toEqual([2025, 2026]);
    expect(defaultValidFrom(2026)).toBe("2026-01-01");
    expect(defaultValidTo(2026)).toBe("2026-12-31");
  });

  it("crea copie abilitate senza mutare il template comune", () => {
    const items = createTemplateItems();

    expect(items).toHaveLength(commonPriceTemplateItems.length);
    expect(items.every((item) => item.is_enabled)).toBe(true);
    expect(items[0]).not.toBe(commonPriceTemplateItems[0]);
    expect("is_enabled" in commonPriceTemplateItems[0]).toBe(false);
  });

  it("include compensi con prezzo e rimborsi Art. 15 a importo libero", () => {
    expect(commonPriceTemplateItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "fee",
          code: "COMP_ACCESSO_CANCELLERIA",
          unit_price: 25,
        }),
        expect.objectContaining({
          kind: "expense_reimbursement",
          code: "RIMB_PIGNORAMENTO",
          unit_price: null,
        }),
      ]),
    );
  });
});
