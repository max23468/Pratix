// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "./clienti.index";
import { routeComponent } from "./-route-test-utils";

const RouteComponent = routeComponent(Route);

const state = vi.hoisted(() => ({
  search: {} as Record<string, string | undefined>,
  isLoading: false,
  clients: [] as Array<Record<string, string | null>>,
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
    if (queryKey[0] === "clients") return { data: state.clients, isLoading: state.isLoading };
    if (queryKey[0] === "principals") {
      return { data: [{ id: "p1", business_name: "Alfa Spa", archived_at: null }] };
    }
    if (queryKey[0] === "principal-clients") {
      return { data: [{ client_id: "c1", principal_id: "p1" }] };
    }
    return { data: undefined };
  },
}));

vi.mock("@/lib/table-sorting", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/table-sorting")>()),
  usePersistentTableSort: ({ defaultSort }: { defaultSort: unknown }) => ({
    sort: defaultSort,
    setSort: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

vi.mock("@/components/app-layout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const client = (id: string, first: string, last: string) => ({
  id,
  public_code: `CLI-${id}`,
  kind: "individual",
  first_name: first,
  last_name: last,
  business_name: null,
  created_at: "2026-01-01T00:00:00Z",
});

describe("Clienti list", () => {
  afterEach(cleanup);

  beforeEach(() => {
    state.search = {};
    state.isLoading = false;
    state.clients = [];
    state.navigate.mockReset();
    window.localStorage.clear();
  });

  it("mostra lo stato di caricamento", () => {
    state.isLoading = true;
    render(<RouteComponent />);
    expect(screen.getAllByText("Caricamento…").length).toBeGreaterThan(0);
  });

  it("mostra lo stato vuoto con azione quando non ci sono filtri", () => {
    render(<RouteComponent />);
    expect(screen.getAllByText("Nessun cliente").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Nuovo cliente" }).length).toBeGreaterThan(1);
  });

  it("mostra lo stato vuoto filtrato senza azione di creazione", () => {
    state.search = { q: "zzz" };
    render(<RouteComponent />);
    expect(screen.getAllByText("Nessun cliente trovato").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Nuovo cliente/ })).toHaveLength(1);
  });

  it("elenca i clienti con i committenti collegati e apre la riga", () => {
    state.clients = [client("c1", "Mario", "Rossi"), client("c2", "Anna", "Bianchi")];
    render(<RouteComponent />);
    expect(screen.getAllByText("Alfa Spa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nessun committente collegato")).toHaveLength(1);

    fireEvent.click(within(screen.getByRole("table")).getByRole("link", { name: /Rossi/ }));
    expect(state.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/clienti/$clientId" }),
    );
  });

  it("filtra per committente collegato", () => {
    state.clients = [client("c1", "Mario", "Rossi"), client("c2", "Anna", "Bianchi")];
    state.search = { principalId: "p1" };
    render(<RouteComponent />);
    expect(within(screen.getByRole("table")).queryByRole("link", { name: /Bianchi/ })).toBeNull();
    expect(within(screen.getByRole("table")).getByRole("link", { name: /Rossi/ })).toBeTruthy();
  });
});
