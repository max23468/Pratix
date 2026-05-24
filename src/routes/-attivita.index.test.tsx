// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Route } from "./attivita.index";

const { navigate, search, supabase } = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {},
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useNavigate: () => navigate,
    useSearch: () => search,
  }),
  Link: ({
    to,
    params,
    className,
    children,
  }: {
    to: string;
    params?: Record<string, string>;
    className?: string;
    children: ReactNode;
  }) => (
    <a href={params?.caseId ? to.replace("$caseId", params.caseId) : to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/app-layout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

const activities = [
  {
    id: "activity-1",
    case_id: "case-1",
    price_book_id: "price-book-1",
    price_item_id: "price-item-1",
    activity_date: "2026-05-09",
    kind: "fee",
    status: "to_invoice",
    needs_review: true,
    snapshot_price_year: 2026,
    snapshot_price_code: "COMP",
    snapshot_price_name: "Udienza",
    description: "Partecipazione udienza",
    quantity: 1,
    unit_price: 120,
    amount: 120,
    invoice_id: null,
    notes: null,
    case_activity_hearings: [],
    activity_attachments: [],
    cases: {
      id: "case-1",
      principal_id: "principal-1",
      client_id: "client-1",
      counterparty_id: "counterparty-1",
      practice_number: 42,
      principals: { business_name: "Banca Test" },
      clients: { kind: "individual", first_name: "Ada", last_name: "Rossi", business_name: null },
      counterparties: {
        kind: "company",
        first_name: null,
        last_name: null,
        business_name: "Beta S.p.A.",
      },
    },
  },
  {
    id: "activity-2",
    case_id: "case-1",
    price_book_id: "price-book-1",
    price_item_id: "price-item-2",
    activity_date: "2026-05-10",
    kind: "expense_reimbursement",
    status: "invoiced",
    needs_review: false,
    snapshot_price_year: 2026,
    snapshot_price_code: "RIMB",
    snapshot_price_name: "Contributo unificato",
    description: "Contributo unificato",
    quantity: 1,
    unit_price: 118.5,
    amount: 118.5,
    invoice_id: "invoice-1",
    notes: null,
    case_activity_hearings: [],
    activity_attachments: [],
    cases: {
      id: "case-1",
      principal_id: "principal-1",
      client_id: "client-1",
      counterparty_id: "counterparty-1",
      practice_number: 42,
      principals: { business_name: "Banca Test" },
      clients: { kind: "individual", first_name: "Ada", last_name: "Rossi", business_name: null },
      counterparties: {
        kind: "company",
        first_name: null,
        last_name: null,
        business_name: "Beta S.p.A.",
      },
    },
  },
];

const renderRoute = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(["activities"], activities);
  return render(
    <QueryClientProvider client={client}>
      {Route.component ? <Route.component /> : null}
    </QueryClientProvider>,
  );
};

describe("pagina Attività", () => {
  afterEach(() => {
    cleanup();
    for (const key of Object.keys(search)) delete (search as Record<string, unknown>)[key];
    vi.clearAllMocks();
  });

  it("permette di aprire la modifica delle Attività non fatturate dalla lista globale", () => {
    renderRoute();

    const table = screen.getByRole("table");
    const editableRow = within(table).getByText("Partecipazione udienza").closest("tr")!;
    const invoicedRow = within(table).getByText("Contributo unificato").closest("tr")!;

    expect(within(editableRow).getAllByRole("button", { name: /Modifica/i })[0].disabled).toBe(
      false,
    );
    expect(within(invoicedRow).getAllByRole("button", { name: /Modifica/i })[0].disabled).toBe(
      true,
    );
    expect(
      within(editableRow)
        .getByRole("link", { name: /Pratica 42/i })
        .getAttribute("href"),
    ).toBe("/pratiche/case-1");
    expect(within(editableRow).getByText("Da verificare")).toBeTruthy();
  });

  it("filtra le Attività con importo da verificare", () => {
    (search as Record<string, unknown>).review = "needs_review";

    renderRoute();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Partecipazione udienza")).toBeTruthy();
    expect(within(table).queryByText("Contributo unificato")).toBeNull();
    expect(screen.getByLabelText("Filtra attività da verificare").textContent).toContain(
      "Da verificare",
    );
  });
});
