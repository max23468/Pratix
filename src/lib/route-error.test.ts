import { describe, expect, it } from "vitest";
import { normalizeRouteError } from "./route-error";

describe("normalizeRouteError", () => {
  it("preserves Error instances and their details", () => {
    const error = new Error("network request failed");
    expect(normalizeRouteError(error)).toBe(error);
  });

  it("preserves a thrown string as the message", () => {
    expect(normalizeRouteError("session expired").message).toBe("session expired");
  });

  it("handles null and arbitrary thrown values", () => {
    for (const value of [null, undefined, 42, { message: "untrusted" }]) {
      expect(normalizeRouteError(value).message).toBe("Errore inatteso");
    }
  });
});
