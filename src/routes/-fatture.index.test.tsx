// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "./fatture.index";
import { routeComponent } from "./-route-test-utils";

const state = vi.hoisted(() => ({ today: "2026-10-09", search: {} }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useLoaderData: () => ({ today: state.today }),
    useNavigate: () => vi.fn(),
    useSearch: () => state.search,
  }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/server/invoices-export.functions", () => ({ generateInvoiceXmlFn: vi.fn() }));
vi.mock("@/lib/invoice-file-exports", () => ({}));
vi.mock("@/components/app-layout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/invoice-list-results", () => ({
  InvoiceListResults: ({ today }: { today: string }) => <output>{today}</output>,
}));
vi.mock("@/lib/table-sorting", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/table-sorting")>()),
  usePersistentTableSort: ({ defaultSort }: { defaultSort: unknown }) => ({
    sort: defaultSort,
    setSort: vi.fn(),
  }),
}));

describe("Invoice reference date", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("captures the UTC day outside render and keeps it serializable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T23:30:00Z"));
    const loader = (Route as unknown as { loader: () => { today: string } }).loader;
    expect(JSON.stringify(loader())).toBe('{"today":"2026-10-09"}');
    vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
    expect(loader()).toEqual({ today: "2026-10-10" });
  });

  it("uses the hydrated loader day instead of reading the clock during render", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
    const Component = routeComponent(Route);
    const { rerender } = render(<Component />);
    expect(screen.getByText("2026-10-09")).toBeTruthy();
    vi.setSystemTime(new Date("2026-10-11T00:00:00Z"));
    rerender(<Component />);
    expect(screen.getByText("2026-10-09")).toBeTruthy();
  });
});
