// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "./prezzi.index";
import { routeComponent } from "./-route-test-utils";

const RouteComponent = routeComponent(Route);

const state = vi.hoisted(() => ({
  search: {} as Record<string, string | undefined>,
  isLoading: false,
  books: [] as Array<Record<string, unknown>>,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useNavigate: () => state.navigate,
    useSearch: () => state.search,
  }),
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
  }) => {
    const path = Object.entries(params ?? {}).reduce(
      (current, [key, value]) => current.replace(`$${key}`, value),
      to,
    );
    return (
      <a href={path} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "price-books") return { data: state.books, isLoading: state.isLoading };
    if (queryKey[0] === "principals") return { data: [{ id: "p1", business_name: "Alfa Spa" }] };
    if (queryKey[0] === "price-items") {
      return {
        data: [
          { price_book_id: "b1", kind: "fee", is_enabled: true },
          { price_book_id: "b1", kind: "fee", is_enabled: true },
          { price_book_id: "b1", kind: "expense_reimbursement", is_enabled: false },
        ],
      };
    }
    return { data: undefined };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

vi.mock("@/components/app-layout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/table-sorting", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/table-sorting")>()),
  usePersistentTableSort: ({ defaultSort }: { defaultSort: unknown }) => ({
    sort: defaultSort,
    setSort: vi.fn(),
  }),
}));

const book = (id: string, year: number) => ({
  id,
  public_code: `PRZ-${id}`,
  principal_id: "p1",
  year,
  status: "active",
  fees_enabled: true,
  expense_reimbursements_enabled: false,
  valid_from: `${year}-01-01`,
  valid_to: null,
  updated_at: `${year}-06-01T00:00:00Z`,
});

describe("Prezzi list", () => {
  afterEach(cleanup);

  beforeEach(() => {
    state.search = {};
    state.isLoading = false;
    state.books = [];
    state.navigate.mockReset();
  });

  it("mostra il caricamento", () => {
    state.isLoading = true;
    render(<RouteComponent />);
    expect(screen.getAllByText("Caricamento…").length).toBeGreaterThan(0);
  });

  it("mostra gli stati vuoti con e senza ricerca", () => {
    render(<RouteComponent />);
    expect(screen.getByText("Nessun prezzo. Crea il primo set annuale.")).toBeTruthy();
    expect(screen.getByText("Nessun prezzo")).toBeTruthy();
    cleanup();

    state.search = { q: "zzz" };
    render(<RouteComponent />);
    expect(screen.getByText("Nessun risultato.")).toBeTruthy();
    expect(screen.getByText("Nessun prezzo trovato")).toBeTruthy();
  });

  it("elenca i prezzi con conteggi voci e apre la riga", () => {
    state.books = [book("b1", 2026)];
    render(<RouteComponent />);
    expect(screen.getAllByText(/2 compensi, 1 rimborsi/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/senza fine/).length).toBeGreaterThan(0);

    fireEvent.click(
      within(screen.getByRole("table")).getByRole("link", { name: /Alfa Spa.*2026/ }),
    );
    expect(state.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/prezzi/$priceBookId" }),
    );
  });

  it("filtra per anno", () => {
    state.books = [book("b1", 2026), book("b2", 2025)];
    state.search = { q: "2025" };
    render(<RouteComponent />);
    expect(
      within(screen.getByRole("table")).queryByRole("link", { name: /Alfa Spa.*2026/ }),
    ).toBeNull();
    expect(
      within(screen.getByRole("table")).getByRole("link", { name: /Alfa Spa.*2025/ }),
    ).toBeTruthy();
  });
});
