// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidate, reset, setMode } = vi.hoisted(() => ({
  invalidate: vi.fn(),
  reset: vi.fn(),
  setMode: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

vi.mock("@/lib/theme-context", () => ({
  useTheme: () => ({ mode: "system", resolved: "dark", setMode }),
}));

import { AppearanceCard } from "./appearance-card";
import { Logo } from "./brand/logo";
import { ComingSoon } from "./coming-soon";
import { DefaultErrorComponent } from "./default-error";
import { PageHeader } from "./page-header";
import { TableEmptyState } from "./table-empty-state";

describe("componenti presentazionali globali", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza stati informativi e azioni leggere", async () => {
    render(
      <>
        <AppearanceCard />
        <ComingSoon title="Sezione in arrivo" description="Disponibile più avanti">
          <button>Avvisami</button>
        </ComingSoon>
        <PageHeader
          title="Pratiche"
          titleAccessory={<span>Aperta</span>}
          description="Elenco operativo"
          actions={<button>Nuova</button>}
        />
        <TableEmptyState
          title="Nessuna attività"
          description="Aggiungi la prima voce."
          action={<button>Aggiungi</button>}
        />
        <Logo direction="bar" form="mark" tone="mono" ariaLabel="Logo bar" />
        <Logo direction="seal" form="wordmark" tone="inverse" ariaLabel="Logo seal" />
        <Logo direction="seal" form="mark" tone="navy" ariaLabel="Logo sigillo" />
      </>,
    );

    expect(screen.getByText(/Tema attivo/)).toBeTruthy();
    expect(screen.getAllByText("Scuro").length).toBeGreaterThan(0);
    expect(screen.getByText("Sezione in arrivo")).toBeTruthy();
    expect(screen.getByText("Pratiche")).toBeTruthy();
    expect(screen.getByText("Aperta")).toBeTruthy();
    expect(screen.getByText("Nessuna attività")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Logo bar" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Logo seal" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Logo sigillo" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /Chiaro/ }));

    expect(setMode).toHaveBeenCalledWith("light");
  });

  it("mostra errore di fallback e permette reset router", async () => {
    render(<DefaultErrorComponent error={new Error("Errore test")} reset={reset} />);

    expect(screen.getByText("Qualcosa è andato storto")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Torna alla home" }).getAttribute("href")).toBe("/");

    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));

    expect(invalidate).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });
});
