import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

/**
 * Tema Pratix.
 *
 * - "light"  forza il tema chiaro
 * - "dark"   forza il tema scuro
 * - "system" segue prefers-color-scheme del sistema operativo
 *
 * La preferenza esplicita dell'utente è persistita in localStorage.
 * Lo script no-flash in `index.html`/`__root.tsx` applica la classe `dark`
 * sul <html> prima del render React per evitare flash.
 */

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const STORAGE_KEY = "pratix.theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  // theme-color per la chrome di iOS / Android
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    // Inchiostro su dark, panna su light — coerente con la palette brand.
    meta.content = resolved === "dark" ? "#1a1f33" : "#fbf8f1";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStored());
  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark());

  // Ascolta cambi di prefers-color-scheme
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolved: "light" | "dark" = useMemo(() => {
    if (mode === "system") return systemDark ? "dark" : "light";
    return mode;
  }, [mode, systemDark]);

  // Applica al DOM ogni volta che cambia
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const toggle = useCallback(() => {
    // Toggle pratico: alterna chiaro <-> scuro mantenendo override esplicito
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error("useTheme deve essere usato dentro <ThemeProvider>");
  return ctx;
}

/**
 * Snippet da iniettare PRIMA del render React per evitare il flash.
 * Legge la preferenza salvata o segue il sistema, e applica la classe `dark`
 * sul <html>. Inline script: niente import.
 */
export const NO_FLASH_SCRIPT = `(() => {
  try {
    var k = '${STORAGE_KEY}';
    var v = localStorage.getItem(k);
    var sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = v === 'dark' || ((v === null || v === 'system') && sys);
    var r = document.documentElement;
    if (dark) r.classList.add('dark');
    r.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();`;
