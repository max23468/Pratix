// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast, supabase, query, single, storage } = vi.hoisted(() => {
  const single = vi.fn();
  const query = {
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => Promise.resolve({ error: null })),
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

vi.mock("@/components/ui/popover", async () => {
  const React = await import("react");
  const PopoverContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>({ open: false, onOpenChange: () => {} });

  return {
    Popover: ({
      children,
      open,
      onOpenChange,
    }: {
      children: ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => (
      <PopoverContext.Provider value={{ open, onOpenChange }}>{children}</PopoverContext.Provider>
    ),
    PopoverTrigger: ({ children }: { children: ReactElement }) => {
      const { open, onOpenChange } = React.useContext(PopoverContext);
      return React.cloneElement(children, { onClick: () => onOpenChange(!open) });
    },
    PopoverContent: ({ children }: { children: ReactNode }) => {
      const { open } = React.useContext(PopoverContext);
      return open ? <div>{children}</div> : null;
    },
  };
});

vi.mock("@/components/ui/command", async () => {
  const React = await import("react");
  const CommandContext = React.createContext<{
    search: string;
    setSearch: (value: string) => void;
  }>({ search: "", setSearch: () => {} });

  return {
    Command: ({ children }: { children: ReactNode }) => {
      const [search, setSearch] = React.useState("");
      return (
        <CommandContext.Provider value={{ search, setSearch }}>
          <div data-command-root="">{children}</div>
        </CommandContext.Provider>
      );
    },
    CommandInput: ({ placeholder }: { placeholder?: string }) => {
      const { search, setSearch } = React.useContext(CommandContext);
      return (
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      );
    },
    CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CommandItem: ({
      children,
      value,
      onSelect,
    }: {
      children: ReactNode;
      value: string;
      onSelect: () => void;
    }) => {
      const { search } = React.useContext(CommandContext);
      const normalizedSearch = search.trim().toLowerCase();
      if (normalizedSearch && !value.toLowerCase().includes(normalizedSearch)) return null;
      return (
        <button type="button" role="option" onClick={onSelect}>
          {children}
        </button>
      );
    },
  };
});

import { CaseActivityDialog, type CaseActivityDialogActivity } from "./case-activities";

const getPracticePickerOptions = () =>
  screen.getAllByRole("option").filter((option) => option.textContent?.includes("Pratica "));

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

const renderDialog = (activity?: CaseActivityDialogActivity) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const year = activity ? Number(activity.activity_date.slice(0, 4)) : new Date().getFullYear();
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
      {
        id: "item-expense",
        kind: "expense_reimbursement",
        code: "SPESE",
        name: "Rimborso spese",
        invoice_description: "Rimborso spese",
        unit_price: null,
        is_enabled: true,
        requires_hearing_dates: false,
        sort_order: 30,
      },
    ],
  );
  return render(
    <QueryClientProvider client={client}>
      <CaseActivityDialog
        caseRow={caseRow}
        activity={activity}
        trigger={activity ? null : undefined}
        open={activity ? true : undefined}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
};

const renderGlobalDialog = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(
    ["cases", "activity-dialog"],
    [
      {
        id: "case-zeta",
        principal_id: "principal-1",
        client_id: "client-1",
        counterparty_id: "counterparty-1",
        practice_number: 30,
        title: "Zeta recupero",
        principals: { business_name: "Studio Test" },
        clients: { kind: "individual", first_name: "Zeno", last_name: "Rossi" },
        counterparties: { kind: "company", business_name: "Zeta S.r.l." },
      },
      {
        id: "case-beta",
        principal_id: "principal-1",
        client_id: "client-1",
        counterparty_id: "counterparty-1",
        practice_number: 20,
        title: "Beta intimazione",
        principals: { business_name: "Studio Test" },
        clients: { kind: "individual", first_name: "Bruno", last_name: "Bianchi" },
        counterparties: { kind: "company", business_name: "Beta S.r.l." },
      },
      {
        id: "case-alfa",
        principal_id: "principal-1",
        client_id: "client-1",
        counterparty_id: "counterparty-1",
        practice_number: 10,
        title: "Alfa diffida",
        principals: { business_name: "Studio Test" },
        clients: { kind: "individual", first_name: "Ada", last_name: "Verdi" },
        counterparties: { kind: "company", business_name: "Alfa S.r.l." },
      },
    ],
  );

  return render(
    <QueryClientProvider client={client}>
      <CaseActivityDialog open trigger={null} onSaved={vi.fn()} />
    </QueryClientProvider>,
  );
};

const editableActivity: CaseActivityDialogActivity = {
  id: "activity-edit",
  case_id: "case-1",
  price_book_id: "book-1",
  price_item_id: "item-1",
  activity_date: `${new Date().getFullYear()}-05-10`,
  kind: "fee",
  status: "to_invoice",
  needs_review: false,
  snapshot_price_year: new Date().getFullYear(),
  snapshot_price_code: "DIFF",
  snapshot_price_name: "Diffida",
  description: "Redazione diffida",
  quantity: 1,
  unit_price: 120,
  amount: 120,
  invoice_id: null,
  notes: "Nota iniziale",
  case_activity_hearings: [],
  activity_attachments: [],
};

const editableExpenseActivity: CaseActivityDialogActivity = {
  ...editableActivity,
  id: "activity-expense-edit",
  price_item_id: "item-expense",
  kind: "expense_reimbursement",
  snapshot_price_code: "SPESE",
  snapshot_price_name: "Rimborso spese",
  description: "Rimborso spese",
  quantity: 2,
  unit_price: 50,
  amount: 100,
  notes: null,
};

describe("CaseActivityDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({ data: { id: "activity-1" }, error: null });
    query.is.mockResolvedValue({ error: null, count: 1 });
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

  it("registra una voce con importo da verificare e motivo nelle note", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Attività/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "item-1");
    await screen.findByDisplayValue("Redazione diffida");
    await userEvent.click(screen.getByRole("checkbox", { name: "Importo da verificare" }));
    await userEvent.type(screen.getByLabelText("Note"), "Tariffa da confermare");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile registrata"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        needs_review: true,
        notes: "Tariffa da confermare",
      }),
    );
  });

  it("registra un rimborso spese come importo libero con virgola decimale", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Attività/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "item-expense");
    await screen.findByDisplayValue("Rimborso spese");

    expect(screen.queryByLabelText("Quantità")).toBeNull();

    const amountInput = screen.getByLabelText("Importo") as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "12,50");

    expect(amountInput.value).toBe("12,50");

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile registrata"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        price_item_id: "item-expense",
        kind: "expense_reimbursement",
        description: "Rimborso spese",
        quantity: 1,
        unit_price: 12.5,
      }),
    );
  });

  it("formatta l'importo libero con due decimali quando il campo perde il focus", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Attività/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "item-expense");
    await screen.findByDisplayValue("Rimborso spese");

    const amountInput = screen.getByLabelText("Importo") as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "16");

    expect(amountInput.value).toBe("16");

    fireEvent.blur(amountInput);

    expect(amountInput.value).toBe("16,00");
  });

  it("non aggiunge separatori delle migliaia all'importo libero formattato", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Attività/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "item-expense");
    await screen.findByDisplayValue("Rimborso spese");

    const amountInput = screen.getByLabelText("Importo") as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "1000");
    fireEvent.blur(amountInput);

    expect(amountInput.value).toBe("1000,00");

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile registrata"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        price_item_id: "item-expense",
        unit_price: 1000,
      }),
    );
  });

  it("accetta importi liberi con separatore migliaia digitato dall'utente", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Attività/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "item-expense");
    await screen.findByDisplayValue("Rimborso spese");

    const amountInput = screen.getByLabelText("Importo") as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "1.000,50");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile registrata"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        price_item_id: "item-expense",
        unit_price: 1000.5,
      }),
    );
  });

  it("mostra le pratiche in ordine alfabetico e permette di cercarle digitando", async () => {
    renderGlobalDialog();

    await userEvent.click(screen.getByRole("combobox", { name: "Seleziona pratica" }));

    expect(getPracticePickerOptions().map((option) => option.textContent)).toEqual([
      expect.stringContaining("Alfa diffida"),
      expect.stringContaining("Beta intimazione"),
      expect.stringContaining("Zeta recupero"),
    ]);

    await userEvent.type(screen.getByPlaceholderText("Cerca pratica…"), "beta");

    expect(getPracticePickerOptions().map((option) => option.textContent)).toEqual([
      expect.stringContaining("Beta intimazione"),
    ]);

    await userEvent.click(screen.getByRole("option", { name: /Beta intimazione/ }));

    expect(screen.getByRole("combobox", { name: "Seleziona pratica" }).textContent).toContain(
      "Pratica 20 · Beta intimazione",
    );
  });

  it("ignora submit attività ripetuti mentre il salvataggio è in corso", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Attività/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "item-1");
    await screen.findByDisplayValue("Redazione diffida");

    const button = screen.getByRole("button", { name: "Salva" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile registrata"));
    expect(query.insert).toHaveBeenCalledTimes(1);
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

  it("modifica una voce fatturabile non collegata a fattura", async () => {
    renderDialog(editableActivity);

    await screen.findByRole("heading", { name: "Modifica voce fatturabile" });
    await userEvent.clear(screen.getByLabelText("Descrizione"));
    await userEvent.type(screen.getByLabelText("Descrizione"), "Diffida aggiornata");
    await userEvent.clear(screen.getByLabelText("Quantità"));
    await userEvent.type(screen.getByLabelText("Quantità"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile aggiornata"));
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_date: editableActivity.activity_date,
        status: "to_invoice",
        needs_review: false,
        description: "Diffida aggiornata",
        quantity: 2,
        unit_price: 120,
        notes: "Nota iniziale",
      }),
      { count: "exact" },
    );
    expect(query.eq).toHaveBeenCalledWith("id", "activity-edit");
    expect(query.is).toHaveBeenCalledWith("invoice_id", null);
  });

  it("modifica un rimborso spese mantenendolo come importo libero", async () => {
    renderDialog(editableExpenseActivity);

    await screen.findByRole("heading", { name: "Modifica voce fatturabile" });

    expect(screen.queryByLabelText("Quantità")).toBeNull();

    const amountInput = screen.getByLabelText("Importo") as HTMLInputElement;
    expect(amountInput.value).toBe("100,00");
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "118,50");
    await userEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce fatturabile aggiornata"));
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Rimborso spese",
        quantity: 1,
        unit_price: 118.5,
      }),
      { count: "exact" },
    );
  });

  it("non modifica udienze e allegati se la voce viene fatturata durante il salvataggio", async () => {
    query.is.mockResolvedValueOnce({ error: null, count: 0 });
    renderDialog(editableActivity);

    await screen.findByRole("heading", { name: "Modifica voce fatturabile" });
    await userEvent.clear(screen.getByLabelText("Descrizione"));
    await userEvent.type(screen.getByLabelText("Descrizione"), "Diffida aggiornata");
    await userEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "La voce è stata collegata a una Fattura e non può più essere modificata",
      ),
    );
    expect(query.delete).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
