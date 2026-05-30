// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidate, reset, routeState, setMode } = vi.hoisted(() => ({
  invalidate: vi.fn(),
  reset: vi.fn(),
  routeState: { pathname: "/pratiche/case-1" },
  setMode: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: routeState.pathname } }),
}));

vi.mock("@/lib/theme-context", () => ({
  useTheme: () => ({ mode: "system", resolved: "dark", setMode }),
}));

import { AppearanceCard } from "./appearance-card";
import { Logo } from "./brand/logo";
import { ComingSoon } from "./coming-soon";
import { DefaultErrorComponent } from "./default-error";
import { MetricTile } from "./metric-tile";
import { MobileListCard } from "./mobile-list-card";
import { MobileListCardDetails } from "./mobile-list-card-details";
import { MobileListCardHeader } from "./mobile-list-card-header";
import { PageHeader } from "./page-header";
import { PageState } from "./page-state";
import { SearchInput } from "./search-input";
import { TableEmptyState } from "./table-empty-state";

describe("componenti presentazionali globali", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.pathname = "/pratiche/case-1";
  });

  it("renderizza stati informativi e azioni leggere", async () => {
    const onSearch = vi.fn();

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
        <PageState variant="not-found" title="Record non trovato" description="Torna alla lista." />
        <SearchInputHarness onSearch={onSearch} />
        <MetricTile label="Da fatturare" value="1.234,00 €" tone="gold" />
        <MobileListCard>
          <MobileListCardHeader title="Mario Rossi" subtitle="Cliente" />
          <MobileListCardDetails rows={[{ label: "Committente", value: "Società Alfa" }]} />
        </MobileListCard>
        <Logo direction="bar" form="mark" tone="mono" ariaLabel="Logo bar" />
        <Logo direction="seal" form="wordmark" tone="inverse" ariaLabel="Logo seal" />
        <Logo direction="seal" form="mark" tone="navy" ariaLabel="Logo sigillo" />
      </>,
    );

    expect(screen.getByText(/Tema attivo/)).toBeTruthy();
    expect(screen.getAllByText("Scuro").length).toBeGreaterThan(0);
    expect(screen.getByText("Sezione in arrivo")).toBeTruthy();
    expect(screen.getAllByText("Pratiche").length).toBeGreaterThan(0);
    expect(screen.getByText("Aperta")).toBeTruthy();
    expect(screen.getByText("Nessuna attività")).toBeTruthy();
    expect(screen.getByText("Record non trovato")).toBeTruthy();
    expect(screen.getByText("Da fatturare")).toBeTruthy();
    expect(screen.getByText("Mario Rossi")).toBeTruthy();
    expect(screen.getByText("Società Alfa")).toBeTruthy();
    expect(screen.getByText("Logo bar")).toBeTruthy();
    expect(screen.getByText("Logo seal")).toBeTruthy();
    expect(screen.getByText("Logo sigillo")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /Chiaro/ }));
    await userEvent.type(screen.getByPlaceholderText("Cerca per nome"), "abc");

    expect(setMode).toHaveBeenCalledWith("light");
    expect(onSearch).toHaveBeenLastCalledWith("abc");
  });

  it("mostra errore di fallback e permette reset router", async () => {
    render(<DefaultErrorComponent error={new Error("Errore test")} reset={reset} />);

    expect(screen.getAllByText("Pratiche").length).toBeGreaterThan(0);
    expect(screen.getByText("Caricamento interrotto")).toBeTruthy();
    expect(screen.getByText(/Pratix ha interrotto il caricamento/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Vai alla Dashboard" }).getAttribute("href")).toBe(
      "/dashboard",
    );

    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));

    expect(invalidate).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });

  it("classifica errori di connessione e sessione con messaggi specifici", () => {
    const view = render(
      <DefaultErrorComponent error={new Error("Failed to fetch")} reset={reset} />,
    );

    expect(screen.getByText("Connessione non riuscita")).toBeTruthy();
    expect(screen.getByText(/non riesce a raggiungere i servizi/)).toBeTruthy();

    routeState.pathname = "/account";
    view.rerender(<DefaultErrorComponent error={new Error("Sessione non valida")} reset={reset} />);

    expect(screen.getByText("Sessione da aggiornare")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Accedi" }).getAttribute("href")).toBe("/login");
  });
});

function SearchInputHarness({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <SearchInput
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onSearch(nextValue);
      }}
      placeholder="Cerca per nome"
      inputClassName="test-input"
    />
  );
}
