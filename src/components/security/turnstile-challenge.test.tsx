// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("TurnstileChallenge", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetModules();
    vi.unstubAllEnvs();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    delete window.turnstile;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("non renderizza nulla quando Turnstile non è configurato", async () => {
    const { TurnstileChallenge } = await import("./turnstile-challenge");
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<TurnstileChallenge action="login" resetSignal={0} onTokenChange={vi.fn()} />);
    });

    expect(container.innerHTML).toBe("");
  });

  it("renderizza, resetta e rimuove il widget quando la chiave è configurata", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key-test");
    const tokenChange = vi.fn();
    const render = vi.fn((_container, options) => {
      options.callback("token-test");
      options["expired-callback"]();
      options["error-callback"]();
      return "widget-1";
    });
    const reset = vi.fn();
    const remove = vi.fn();
    window.turnstile = { render, reset, remove };
    const { TurnstileChallenge } = await import("./turnstile-challenge");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TurnstileChallenge action="register" resetSignal={0} onTokenChange={tokenChange} />,
      );
    });

    expect(render).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        sitekey: "site-key-test",
        action: "register",
        theme: "auto",
      }),
    );
    expect(tokenChange).toHaveBeenCalledWith("token-test");
    expect(tokenChange).toHaveBeenCalledWith(null);

    await act(async () => {
      root.render(
        <TurnstileChallenge action="register" resetSignal={1} onTokenChange={tokenChange} />,
      );
    });
    expect(reset).toHaveBeenCalledWith("widget-1");

    await act(async () => {
      root.unmount();
    });
    expect(remove).toHaveBeenCalledWith("widget-1");
  });
});
