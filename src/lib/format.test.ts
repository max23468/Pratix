import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatDateInput } from "./format";

const normalizeSpaces = (value: string) => value.replace(/\s/g, " ");

describe("formatCurrency", () => {
  it("formatta valori numerici in euro e usa zero per valori assenti", () => {
    expect(normalizeSpaces(formatCurrency(12.5))).toBe("12,50 €");
    expect(normalizeSpaces(formatCurrency(null))).toBe("0,00 €");
    expect(normalizeSpaces(formatCurrency(undefined))).toBe("0,00 €");
  });
});

describe("formatDate", () => {
  it("formatta date valide e protegge valori assenti o non validi", () => {
    expect(formatDate("2026-05-09")).toBe("9 mag 2026");
    expect(formatDate(new Date("2026-05-09T10:00:00.000Z"))).toBe("9 mag 2026");
    expect(formatDate("non-data")).toBe("—");
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatDateInput", () => {
  it("normalizza date valide per input HTML e restituisce stringa vuota per valori non validi", () => {
    expect(formatDateInput("2026-05-09")).toBe("2026-05-09");
    expect(formatDateInput(new Date("2026-05-09T10:00:00.000Z"))).toBe("2026-05-09");
    expect(formatDateInput("non-data")).toBe("");
    expect(formatDateInput(undefined)).toBe("");
  });
});
