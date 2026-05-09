import { describe, expect, it } from "vitest";

import { queryClient } from "./query-client";

describe("queryClient", () => {
  it("usa default coerenti con l'app", () => {
    const defaults = queryClient.getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });
});
