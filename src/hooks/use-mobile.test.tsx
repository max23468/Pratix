// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./use-mobile";

function Probe() {
  return <span>{useIsMobile() ? "mobile" : "desktop"}</span>;
}

describe("useIsMobile", () => {
  const listeners = new Set<() => void>();

  beforeEach(() => {
    listeners.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("calcola lo stato mobile da innerWidth e reagisce ai change event", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    render(<Probe />);

    await screen.findByText("desktop");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    listeners.forEach((listener) => listener());

    await waitFor(() => expect(screen.getByText("mobile")).toBeTruthy());
  });
});
