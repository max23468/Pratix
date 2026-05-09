// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast, navigate, createBillingInvoice, supabase } = vi.hoisted(() => {
  const dataFor = (table: string) => {
    if (table === "profiles") {
      return {
        data: {
          cassa_rate: 4,
          vat_rate: 22,
          withholding_rate: 20,
          tax_regime: "ordinario",
        },
        error: null,
      };
    }
    if (table === "principals") {
      return {
        data: [
          {
            id: "principal-1",
            business_name: "Banca Test",
            default_general_expenses_rate: 10,
            default_cassa_rate: 4,
          },
        ],
        error: null,
      };
    }
    if (table === "case_activities") {
      return {
        data: [
          {
            id: "activity-fee",
            activity_date: "2026-05-10",
            kind: "fee",
            status: "to_invoice",
            description: "Redazione diffida",
            quantity: 2,
            unit_price: 500,
            amount: 1000,
            postponed_until: null,
            cases: { practice_number: 42, title: "Pratica 42" },
            clients: {
              kind: "individual",
              first_name: "Ada",
              last_name: "Rossi",
              business_name: null,
            },
            counterparties: {
              kind: "company",
              first_name: null,
              last_name: null,
              business_name: "Beta S.p.A.",
            },
          },
          {
            id: "activity-expense",
            activity_date: "2026-05-11",
            kind: "expense_reimbursement",
            status: "to_invoice",
            description: "Contributo unificato",
            quantity: 1,
            unit_price: 118.5,
            amount: 118.5,
            postponed_until: null,
            cases: { practice_number: 42, title: "Pratica 42" },
            clients: {
              kind: "individual",
              first_name: "Ada",
              last_name: "Rossi",
              business_name: null,
            },
            counterparties: {
              kind: "company",
              first_name: null,
              last_name: null,
              business_name: "Beta S.p.A.",
            },
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  };
  const builderFor = (table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(dataFor(table))),
      then: (
        onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
        onrejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(dataFor(table)).then(onfulfilled, onrejected),
    };
    return builder;
  };
  return {
    toast: { success: vi.fn(), error: vi.fn() },
    navigate: vi.fn(),
    createBillingInvoice: vi.fn(() =>
      Promise.resolve({
        invoiceId: "invoice-1",
        billingRunId: "run-1",
        number: "12",
        year: 2026,
        exports: [],
      }),
    ),
    supabase: {
      from: vi.fn((table: string) => builderFor(table)),
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: { access_token: "token-test" } } }),
        ),
      },
    },
  };
});

vi.mock("sonner", () => ({ toast }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => createBillingInvoice,
}));

vi.mock("@/server/invoices.functions", () => ({
  createBillingInvoiceFn: {},
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => (
    <select value={value} onChange={(event) => onValueChange(event.target.value)}>
      <option value="">Seleziona</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}));

import { InvoiceForm } from "./invoice-form";

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("InvoiceForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("genera una fattura con attività incluse, rinviate e regole fiscali aggiornate", async () => {
    render(<InvoiceForm />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Redazione diffida");
    await screen.findByText("Contributo unificato");

    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "issued");
    await userEvent.clear(screen.getByLabelText("Pagamento"));
    await userEvent.type(screen.getByLabelText("Pagamento"), "Carta");
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.clear(screen.getByLabelText("Percentuale spese generali (%)"));
    await userEvent.type(screen.getByLabelText("Percentuale spese generali (%)"), "12");
    await userEvent.clear(screen.getByLabelText("IVA (%)"));
    await userEvent.type(screen.getByLabelText("IVA (%)"), "10");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[3], "postponed");
    await userEvent.type(
      screen.getByPlaceholderText("Note interne o descrizione da riportare in fattura"),
      "Note fattura",
    );
    await userEvent.click(screen.getByRole("button", { name: /Genera fattura/ }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Fattura 12/2026 generata"));
    expect(createBillingInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          principalId: "principal-1",
          status: "issued",
          includeGeneralExpenses: true,
          generalExpensesRate: 12,
          vatRate: 10,
          paymentMethod: "Carta",
          notes: "Note fattura",
          selections: [
            { activityId: "activity-fee", status: "included" },
            { activityId: "activity-expense", status: "postponed" },
          ],
        }),
        headers: { Authorization: "Bearer token-test" },
      }),
    );
    expect(navigate).toHaveBeenCalledWith({
      to: "/fatture/$invoiceId",
      params: { invoiceId: "invoice-1" },
    });
  });
});
