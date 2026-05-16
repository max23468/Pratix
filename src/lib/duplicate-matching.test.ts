import { describe, expect, it } from "vitest";
import {
  businessNameSimilarity,
  candidateConfidence,
  duplicatePairKey,
  normalizeBusinessName,
  normalizeDuplicateText,
  personNameSimilarity,
  shouldWarnBeforeCreate,
} from "./duplicate-matching";

describe("duplicate matching", () => {
  it("normalizza ragioni sociali comuni senza dipendere da P.IVA o CF", () => {
    expect(normalizeBusinessName("ACME S.R.L.")).toBe("acme");
    expect(businessNameSimilarity("ACME S.R.L.", "Acme srl")).toBeGreaterThan(0.95);
  });

  it("riconosce nomi persona diretti e invertiti", () => {
    expect(
      personNameSimilarity(
        { firstName: "Mario", lastName: "Rossi" },
        { firstName: "Rossi", lastName: "Mario" },
      ),
    ).toBeGreaterThan(0.85);
  });

  it("mantiene una chiave coppia stabile indipendente dall'ordine", () => {
    expect(duplicatePairKey("client", "b", "a")).toBe(duplicatePairKey("client", "a", "b"));
  });

  it("usa soglie diverse per avvisi preventivi e sospetti bassi", () => {
    expect(candidateConfidence(0.9)).toBe("high");
    expect(candidateConfidence(0.78)).toBe("medium");
    expect(candidateConfidence(0.65)).toBe("low");
    expect(shouldWarnBeforeCreate({ confidence: "medium" })).toBe(true);
    expect(shouldWarnBeforeCreate({ confidence: "low" })).toBe(false);
  });

  it("stabilizza accenti, apostrofi e spazi", () => {
    expect(normalizeDuplicateText("  L'Attività   Società  ")).toBe("l attivita societa");
  });
});
