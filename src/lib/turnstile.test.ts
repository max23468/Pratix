import { describe, expect, it } from "vitest";

import { isTurnstileEnabled, TURNSTILE_SITE_KEY } from "./turnstile";

describe("turnstile config", () => {
  it("espone lo stato di abilitazione dalla chiave pubblica configurata", () => {
    expect(isTurnstileEnabled()).toBe(Boolean(TURNSTILE_SITE_KEY));
  });
});
