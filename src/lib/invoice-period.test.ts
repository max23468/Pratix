import { describe, expect, it } from "vitest";

import { invoicePeriodLabel, quarterKeyForPeriod, quarterRange } from "./invoice-period";

describe("invoice-period", () => {
  it("riconosce i trimestri solari completi", () => {
    expect(quarterRange(2026, 1)).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(quarterRange(2026, 4)).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(quarterKeyForPeriod("2026-04-01", "2026-06-30")).toBe("2026-Q2");
  });

  it("mostra un periodo leggibile anche quando non coincide con un trimestre", () => {
    expect(invoicePeriodLabel({ period_start: "2026-07-01", period_end: "2026-09-30" })).toBe(
      "3° trimestre 2026",
    );
    expect(invoicePeriodLabel({ period_start: "2026-07-15", period_end: "2026-08-31" })).toBe(
      "15/07-31/08",
    );
    expect(invoicePeriodLabel(null)).toBe("—");
  });
});
