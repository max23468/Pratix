// @vitest-environment jsdom

import { act, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NO_FLASH_SCRIPT, ThemeProvider, useTheme } from "./theme-context";

const createMatchMedia = (matches: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

function ThemeProbe({ onValue }: { onValue: (value: ReturnType<typeof useTheme>) => void }) {
  const theme = useTheme();
  useEffect(() => {
    onValue(theme);
  }, [onValue, theme]);
  return (
    <button type="button" onClick={() => theme.toggle()}>
      {theme.mode}:{theme.resolved}
    </button>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        clear: () => storage.clear(),
      },
    });
    document.head.innerHTML = '<meta name="theme-color" content="">';
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    window.localStorage.clear();
    window.matchMedia = createMatchMedia(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("legge preferenza salvata, applica classe dark e permette toggle esplicito", async () => {
    window.localStorage.setItem("pratix.theme", "system");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let latest: ReturnType<typeof useTheme> | null = null;

    await act(async () => {
      root.render(
        <ThemeProvider>
          <ThemeProbe onValue={(value) => (latest = value)} />
        </ThemeProvider>,
      );
    });

    expect(latest).toMatchObject({ mode: "system", resolved: "dark" });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      "#1a1f33",
    );

    await act(async () => latest?.toggle());

    expect(window.localStorage.getItem("pratix.theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("espone errore se useTheme viene usato fuori dal provider e mantiene lo script no-flash", () => {
    function BrokenProbe() {
      useTheme();
      return null;
    }

    expect(() => {
      renderWithoutProvider(<BrokenProbe />);
    }).toThrow("useTheme deve essere usato dentro <ThemeProvider>");
    expect(NO_FLASH_SCRIPT).toContain("pratix.theme");
    expect(NO_FLASH_SCRIPT).toContain("prefers-color-scheme");
  });
});

function renderWithoutProvider(node: ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
}
