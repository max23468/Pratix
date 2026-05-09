// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast, supabase, query, single, storage } = vi.hoisted(() => {
  const single = vi.fn();
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    single,
  };
  const storage = {
    upload: vi.fn(() => Promise.resolve({ error: null })),
  };
  return {
    toast: { success: vi.fn(), error: vi.fn() },
    query,
    single,
    storage,
    supabase: {
      from: vi.fn(() => query),
      storage: {
        from: vi.fn(() => storage),
      },
    },
  };
});

vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const DialogOpenContext = React.createContext<(open: boolean) => void>(() => {});
  return {
    Dialog: ({
      children,
      onOpenChange,
    }: {
      children: ReactNode;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <DialogOpenContext.Provider value={onOpenChange ?? (() => {})}>
        {children}
      </DialogOpenContext.Provider>
    ),
    DialogTrigger: ({ children }: { children: ReactElement }) => {
      const setOpen = React.useContext(DialogOpenContext);
      return React.cloneElement(children, { onClick: () => setOpen(true) });
    },
    DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
    DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  };
});

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

import { CaseActivityDialog } from "./case-activities";

const caseRow = {
  id: "case-1",
  principal_id: "principal-1",
  client_id: "client-1",
  counterparty_id: "counterparty-1",
  practice_number: 42,
  clients: { kind: "individual", first_name: "Ada", last_name: "Rossi", business_name: null },
  counterparties: {
    kind: "company",
    first_name: null,
    last_name: null,
    business_name: "Beta S.p.A.",
  },
};

const renderDialog = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const year = new Date().getFullYear();
  client.setQueryData(
    ["price-books", "activity", "principal-1", year],
    [
      {
        id: "book-1",
        principal_id: "principal-1",
        year,
        status: "active",
        fees_enabled: true,
        expense_reimbursements_enabled: true,
      },
    ],
  );
  client.setQueryData(
    ["price-items", "activity", "book-1"],
    [
      {
        id: "item-1",
        kind: "fee",
        code: "DIFF",
        name: "Diffida",
        invoice_description: "Redazione diffida",
        unit_price: 120,
        is_enabled: true,
        requires_hearing_dates: false,
        sort_order: 10,
      },
      {
        id: "item-hearing",
        kind: "fee",
        code: "UD",
        name: "Udienza",
        invoice_description: "Partecipazione udienza",
        unit_price: 150,
        is_enabled: true,
        requires_hearing_dates: true,
        sort_order: 20,
      },
    ],
  );
  return render(
    <QueryClientProvider client={client}>
      <CaseActivityDialog caseRow={caseRow} onSaved={vi.fn()} />
    </QueryClientProvider>,
  );
};

describe("CaseActivityDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({ data: { id: "activity-1" }, error: null });
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("registra una voce fatturabile da prezzo selezionato", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Attività/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "item-1");
    await screen.findByDisplayValue("Redazione diffida");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile registrata"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        case_id: "case-1",
        price_book_id: "book-1",
        price_item_id: "item-1",
        description: "Redazione diffida",
        quantity: 1,
        unit_price: 120,
      }),
    );
  });

  it("registra una voce con udienze e allegato", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Attività/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "item-hearing");
    await screen.findByDisplayValue("Partecipazione udienza");
    await userEvent.clear(screen.getByLabelText("Numero udienze"));
    await userEvent.type(screen.getByLabelText("Numero udienze"), "2");
    await userEvent.type(screen.getByLabelText("Udienza 1"), "2026-05-20");
    await userEvent.type(screen.getByLabelText("Udienza 2"), "2026-06-20");
    await userEvent.upload(
      screen.getByLabelText("Allegato"),
      new File(["pdf"], "verbale.pdf", { type: "application/pdf" }),
    );
    await userEvent.clear(screen.getByLabelText("Nome descrittivo"));
    await userEvent.type(screen.getByLabelText("Nome descrittivo"), "Verbale udienza");
    await userEvent.type(screen.getByLabelText("Tipo documento"), "verbale");
    await userEvent.type(screen.getByLabelText("Note allegato"), "Documento test");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile registrata"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        price_item_id: "item-hearing",
        description: "Partecipazione udienza",
        quantity: 2,
        unit_price: 150,
      }),
    );
    expect(query.insert).toHaveBeenCalledWith([
      expect.objectContaining({ hearing_date: "2026-05-20", position: 1 }),
      expect.objectContaining({ hearing_date: "2026-06-20", position: 2 }),
    ]);
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringContaining("verbale.pdf"),
      expect.any(File),
      { contentType: "application/pdf", upsert: false },
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: "Verbale udienza",
        document_type: "verbale",
        preview_available: true,
        notes: "Documento test",
      }),
    );
  });
});
