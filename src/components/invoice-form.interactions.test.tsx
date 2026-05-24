// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  toast,
  navigate,
  createBillingInvoice,
  updateDraftBillingInvoice,
  createBillingInvoiceFn,
  updateDraftBillingInvoiceFn,
  setProfileTaxRegime,
  supabase,
  setEmitProgrammaticSelectChanges,
  shouldEmitProgrammaticSelectChanges,
  setActiveBlocker,
  getActiveBlocker,
} = vi.hoisted(() => {
  let profileTaxRegime: "ordinario" | "forfettario" = "ordinario";
  let emitProgrammaticSelectChanges = false;
  let activeBlocker: { blockerFn: () => boolean | Promise<boolean> } | null = null;
  const dataFor = (table: string) => {
    if (table === "invoices") {
      return {
        data: {
          id: "invoice-1",
          principal_id: "principal-1",
          issue_date: "2026-06-01",
          due_date: "2026-06-30",
          status: "draft",
          billing_run_id: "run-1",
          include_general_expenses: true,
          general_expenses_rate: 10,
          cassa_rate: 4,
          vat_rate: 22,
          withholding_rate: 20,
          apply_withholding: true,
          payment_method: "Bonifico bancario",
          notes: "Bozza da completare",
        },
        error: null,
      };
    }
    if (table === "billing_runs") {
      return {
        data: {
          period_start: "2026-05-01",
          period_end: "2026-05-31",
        },
        error: null,
      };
    }
    if (table === "billing_run_items") {
      return {
        data: [
          { activity_id: "activity-fee", status: "included" },
          { activity_id: "activity-expense", status: "excluded" },
        ],
        error: null,
      };
    }
    if (table === "profiles") {
      return {
        data: {
          cassa_rate: 4,
          vat_rate: 22,
          withholding_rate: 20,
          tax_regime: profileTaxRegime,
          include_stamp_duty: false,
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
            needs_review: true,
            invoice_id: null,
            description: "Redazione diffida",
            quantity: 2,
            unit_price: 500,
            amount: 1000,
            postponed_until: null,
            cases: { practice_number: 42 },
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
            needs_review: false,
            invoice_id: null,
            description: "Contributo unificato",
            quantity: 1,
            unit_price: 118.5,
            amount: 118.5,
            postponed_until: null,
            cases: { practice_number: 42 },
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
      in: vi.fn(() => builder),
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
    createBillingInvoiceFn: {},
    updateDraftBillingInvoiceFn: {},
    createBillingInvoice: vi.fn(() =>
      Promise.resolve({
        invoiceId: "invoice-1",
        invoiceRef: "FT-00001",
        billingRunId: "run-1",
        number: "12",
        year: 2026,
        exports: [],
      }),
    ),
    updateDraftBillingInvoice: vi.fn(() =>
      Promise.resolve({
        invoiceId: "invoice-1",
        invoiceRef: "FT-00001",
        billingRunId: "run-1",
        number: "12",
        year: 2026,
        exports: [],
      }),
    ),
    setProfileTaxRegime: (regime: "ordinario" | "forfettario") => {
      profileTaxRegime = regime;
    },
    setEmitProgrammaticSelectChanges: (value: boolean) => {
      emitProgrammaticSelectChanges = value;
    },
    shouldEmitProgrammaticSelectChanges: () => emitProgrammaticSelectChanges,
    setActiveBlocker: (blocker: { blockerFn: () => boolean | Promise<boolean> } | null) => {
      activeBlocker = blocker;
    },
    getActiveBlocker: () => activeBlocker,
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
  useRouter: () => ({
    history: {
      block: (blocker: { blockerFn: () => boolean | Promise<boolean> }) => {
        setActiveBlocker(blocker);
        return () => setActiveBlocker(null);
      },
    },
  }),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: unknown) =>
    serverFn === updateDraftBillingInvoiceFn ? updateDraftBillingInvoice : createBillingInvoice,
}));

vi.mock("@/server/invoices.functions", () => ({
  createBillingInvoiceFn,
  updateDraftBillingInvoiceFn,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

vi.mock("@/components/ui/select", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: ReactNode;
    }) => {
      const previousValue = React.useRef(value);

      React.useEffect(() => {
        if (
          shouldEmitProgrammaticSelectChanges() &&
          previousValue.current !== value &&
          value.length > 0
        ) {
          onValueChange(value);
        }
        previousValue.current = value;
      }, [onValueChange, value]);

      return (
        <select value={value} onChange={(event) => onValueChange(event.target.value)}>
          <option value="">Seleziona</option>
          {children}
        </select>
      );
    },
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

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
    setProfileTaxRegime("ordinario");
    setEmitProgrammaticSelectChanges(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("crea una fattura emessa con attività incluse, rinviate e regole fiscali aggiornate", async () => {
    const invoiceYear = new Date().getFullYear();
    render(<InvoiceForm />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Redazione diffida");
    await screen.findByText("Contributo unificato");

    await userEvent.clear(screen.getByLabelText("Pagamento"));
    await userEvent.type(screen.getByLabelText("Pagamento"), "Carta");
    await userEvent.clear(screen.getByLabelText("Percentuale spese generali (%)"));
    await userEvent.type(screen.getByLabelText("Percentuale spese generali (%)"), "12");
    await userEvent.clear(screen.getByLabelText("IVA (%)"));
    await userEvent.type(screen.getByLabelText("IVA (%)"), "10");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], `${invoiceYear}-Q1`);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[4], "postponed");
    await userEvent.type(
      screen.getByPlaceholderText("Es. Attività da fatturare per il periodo indicato"),
      "Note fattura",
    );
    await userEvent.click(screen.getByRole("button", { name: /Crea fattura/ }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Fattura 12/2026 creata"));
    expect(createBillingInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          principalId: "principal-1",
          periodStart: `${invoiceYear}-01-01`,
          periodEnd: `${invoiceYear}-03-31`,
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
      params: { invoiceId: "FT-00001" },
    });
  });

  it("salva una fattura in bozza e ignora submit ripetuti durante il salvataggio", async () => {
    render(<InvoiceForm />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Redazione diffida");

    const button = screen.getByRole("button", { name: /Salva bozza/ });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Bozza 12/2026 salvata"));
    expect(createBillingInvoice).toHaveBeenCalledTimes(1);
    expect(createBillingInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "draft",
        }),
      }),
    );
  });

  it("aggiorna una bozza esistente e può segnarla come emessa", async () => {
    render(<InvoiceForm draftInvoiceRef="FT-00001" />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await screen.findByText("Redazione diffida");
    await userEvent.click(screen.getByRole("button", { name: /Segna come emessa/ }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Fattura 12/2026 emessa"));
    expect(updateDraftBillingInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "invoice-1",
          principalId: "principal-1",
          status: "issued",
          selections: [
            { activityId: "activity-fee", status: "included" },
            { activityId: "activity-expense", status: "excluded" },
          ],
        }),
      }),
    );
  });

  it("non segnala modifiche non salvate dopo il solo caricamento di una bozza", async () => {
    setEmitProgrammaticSelectChanges(true);
    render(<InvoiceForm draftInvoiceRef="FT-00001" />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await screen.findByText("Redazione diffida");

    const blocker = getActiveBlocker();
    expect(blocker).not.toBeNull();
    const result = await Promise.race([
      Promise.resolve(blocker!.blockerFn()),
      new Promise((resolve) => window.setTimeout(() => resolve("blocked"), 0)),
    ]);
    expect(result).toBe(false);
    expect(screen.queryByText("Modifiche non salvate")).toBeNull();
  });

  it("nasconde l'IVA dal riepilogo per il regime forfettario", async () => {
    setProfileTaxRegime("forfettario");
    render(<InvoiceForm />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Redazione diffida");

    const summaryCard = screen.getByText("Riepilogo").parentElement?.parentElement;
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard as HTMLElement).queryByText("IVA")).toBeNull();
    expect(within(summaryCard as HTMLElement).getByText("Cassa Forense")).toBeTruthy();
  });

  it("non mostra il bollo nel riepilogo quando la preferenza è disattiva", async () => {
    render(<InvoiceForm />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Contributo unificato");

    const summaryCard = screen.getByText("Riepilogo").parentElement?.parentElement;
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard as HTMLElement).queryByText("Bollo")).toBeNull();
  });
});
