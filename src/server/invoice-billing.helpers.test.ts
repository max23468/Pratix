import { describe, expect, it } from "vitest";

import {
  billingDatePattern,
  billingPartyName,
  nextBillingPeriodStart,
} from "./invoice-billing.helpers";

describe("billingPartyName", () => {
  it("formatta persone fisiche, società e fallback", () => {
    expect(billingPartyName({ kind: "individual", first_name: "Ada", last_name: "Rossi" })).toBe(
      "Ada Rossi",
    );
    expect(billingPartyName({ kind: "company", business_name: "Alfa S.r.l." })).toBe("Alfa S.r.l.");
    expect(billingPartyName(null)).toBe("—");
    expect(billingPartyName({ kind: "individual", first_name: null, last_name: null })).toBe("—");
    expect(billingPartyName({ kind: "company", business_name: null })).toBe("—");
  });
});

describe("nextBillingPeriodStart", () => {
  it("calcola il primo giorno successivo al periodo anche a fine mese e fine anno", () => {
    expect(nextBillingPeriodStart("2026-01-31")).toBe("2026-02-01");
    expect(nextBillingPeriodStart("2026-12-31")).toBe("2027-01-01");
  });
});

describe("billingDatePattern", () => {
  it("accetta solo date nel formato ISO atteso dalla server function", () => {
    expect(billingDatePattern.test("2026-05-09")).toBe(true);
    expect(billingDatePattern.test("09/05/2026")).toBe(false);
    expect(billingDatePattern.test("2026-5-9")).toBe(false);
  });
});
