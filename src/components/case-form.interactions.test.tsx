// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast, supabase, query, single } = vi.hoisted(() => {
  const single = vi.fn();
  const queryData = (table: string) => {
    if (table === "principals") {
      return {
        data: [{ id: "principal-1", business_name: "Banca Test", archived_at: null }],
        error: null,
      };
    }
    if (table === "clients") {
      return {
        data: [
          {
            id: "client-1",
            kind: "individual",
            first_name: "Ada",
            last_name: "Rossi",
            business_name: null,
          },
          {
            id: "client-old",
            kind: "company",
            first_name: null,
            last_name: null,
            business_name: "Vecchio cliente",
          },
        ],
        error: null,
      };
    }
    if (table === "principal_clients") {
      return { data: [{ client_id: "client-1" }], error: null };
    }
    if (table === "counterparties") {
      return {
        data: [
          {
            id: "counterparty-1",
            kind: "company",
            first_name: null,
            last_name: null,
            business_name: "Beta S.p.A.",
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  };
  const query = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    single,
    then: (
      onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected),
  };
  const builderFor = (table: string) => {
    const builder = {
      select: vi.fn((...args: unknown[]) => {
        query.select(...args);
        return builder;
      }),
      insert: vi.fn((...args: unknown[]) => {
        query.insert(...args);
        return builder;
      }),
      update: vi.fn((...args: unknown[]) => {
        query.update(...args);
        return builder;
      }),
      delete: vi.fn((...args: unknown[]) => {
        query.delete(...args);
        return builder;
      }),
      eq: vi.fn((...args: unknown[]) => {
        query.eq(...args);
        return builder;
      }),
      is: vi.fn((...args: unknown[]) => {
        query.is(...args);
        return builder;
      }),
      order: vi.fn((...args: unknown[]) => {
        query.order(...args);
        return builder;
      }),
      single,
      then: (
        onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
        onrejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(queryData(table)).then(onfulfilled, onrejected),
    };
    return builder;
  };
  return {
    toast: { success: vi.fn(), error: vi.fn() },
    query,
    single,
    supabase: {
      from: vi.fn((table: string) => builderFor(table)),
      rpc: vi.fn(() => Promise.resolve({ data: 157, error: null })),
    },
  };
});

let activeBlocker: { blockerFn: () => boolean | Promise<boolean> } | null = null;

vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: {
      block: (blocker: { blockerFn: () => boolean | Promise<boolean> }) => {
        activeBlocker = blocker;
        return () => {
          activeBlocker = null;
        };
      },
    },
  }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
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

import { CaseForm } from "./case-form";

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("CaseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeBlocker = null;
    single.mockReset();
    single.mockResolvedValue({ data: { id: "case-1" }, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("crea una pratica recuperando numero progressivo e payload normalizzato", async () => {
    const onSaved = vi.fn();
    render(<CaseForm onSaved={onSaved} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Ada Rossi");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "client-1");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "counterparty-1");
    await userEvent.clear(screen.getByLabelText("Titolo"));
    await userEvent.type(screen.getByLabelText("Titolo"), " Recupero fattura ");
    await userEvent.type(screen.getByLabelText("Autorità giudiziaria"), " Tribunale di Milano ");
    await userEvent.type(screen.getByLabelText("N. R.G."), " 123/2026 ");
    await userEvent.type(screen.getByLabelText("Note"), " Nota pratica ");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pratica creata"));
    expect(supabase.rpc).toHaveBeenCalledWith("get_next_practice_number");
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        principal_id: "principal-1",
        client_id: "client-1",
        counterparty_id: "counterparty-1",
        practice_number: 157,
        case_number: "157",
        title: "Recupero fattura",
        authority: "Tribunale di Milano",
        rg_number: "123/2026",
        notes: "Nota pratica",
      }),
    );
    expect(onSaved).toHaveBeenCalledWith("case-1");
  });

  it("ignora submit pratica ripetuti mentre il salvataggio è in corso", async () => {
    render(<CaseForm onSaved={vi.fn()} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Ada Rossi");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "client-1");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "counterparty-1");

    const form = screen.getByRole("button", { name: "Salva" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pratica creata"));
    expect(query.insert).toHaveBeenCalledTimes(1);
  });

  it("crea anagrafiche minime rapide e le collega alla nuova pratica", async () => {
    single
      .mockResolvedValueOnce({ data: { id: "principal-new" }, error: null })
      .mockResolvedValueOnce({ data: { id: "client-new" }, error: null })
      .mockResolvedValueOnce({ data: { id: "counterparty-new" }, error: null })
      .mockResolvedValueOnce({ data: { id: "case-quick" }, error: null });

    const onSaved = vi.fn();
    render(<CaseForm onSaved={onSaved} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");

    await userEvent.click(screen.getAllByRole("button", { name: /Nuovo/ })[0]);
    await userEvent.type(screen.getByLabelText("Nome committente"), " Nuovo Mandante ");
    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Committente creato"));

    await userEvent.click(screen.getAllByRole("button", { name: /Nuovo/ })[1]);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "individual");
    await userEvent.type(screen.getByLabelText("Nome"), " Ada ");
    await userEvent.type(screen.getByLabelText("Cognome"), " Verdi ");
    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cliente creato"));

    await userEvent.click(screen.getByRole("button", { name: /Nuova/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[3], "company");
    await userEvent.type(screen.getByLabelText("Ragione sociale"), " Beta Debitrice ");
    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Controparte creata"));

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pratica creata"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        business_name: "Nuovo Mandante",
      }),
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        kind: "individual",
        first_name: "Ada",
        last_name: "Verdi",
        business_name: null,
      }),
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        principal_id: "principal-new",
        client_id: "client-new",
      }),
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        kind: "company",
        first_name: null,
        last_name: null,
        business_name: "Beta Debitrice",
      }),
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        principal_id: "principal-new",
        client_id: "client-new",
        counterparty_id: "counterparty-new",
        practice_number: 157,
      }),
    );
    expect(onSaved).toHaveBeenCalledWith("case-quick");
  });

  it("aggiorna una pratica e registra il trasferimento quando cambia cliente", async () => {
    const onSaved = vi.fn();
    render(
      <CaseForm
        initial={{
          id: "case-1",
          principal_id: "principal-1",
          client_id: "client-old",
          counterparty_id: "counterparty-1",
          practice_number: 42,
          case_number: "42",
          title: "",
          matter: "civile",
          status: "open",
          opened_at: "2026-05-09",
          notes: " Nota iniziale ",
        }}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await screen.findByText("Ada Rossi");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "client-1");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pratica aggiornata"));
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-1",
        title: "Pratica 42",
        notes: "Nota iniziale",
      }),
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        case_id: "case-1",
        previous_client_id: "client-old",
        new_client_id: "client-1",
      }),
    );
    expect(onSaved).toHaveBeenCalledWith("case-1");
  });

  it("non segnala modifiche non salvate mentre carica una pratica esistente", async () => {
    render(
      <CaseForm
        initial={{
          id: "case-1",
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-1",
          practice_number: 42,
          case_number: "42",
          title: "Pratica esistente",
          matter: "civile",
          status: "open",
          opened_at: "2026-05-09",
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await screen.findByText("Ada Rossi");
    expect(activeBlocker).not.toBeNull();

    const result = await Promise.race([
      Promise.resolve(activeBlocker!.blockerFn()),
      new Promise((resolve) => window.setTimeout(() => resolve("blocked"), 0)),
    ]);

    expect(result).toBe(false);
    expect(screen.queryByText("Modifiche non salvate")).toBeNull();
  });

  it("blocca salvataggio senza selezioni obbligatorie o numero pratica valido", async () => {
    render(<CaseForm onSaved={vi.fn()} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Seleziona un committente"));
    cleanup();
    vi.clearAllMocks();

    render(
      <CaseForm
        initial={{
          id: "case-invalid",
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-1",
          practice_number: 0,
          case_number: "",
          title: "",
          matter: "civile",
          status: "open",
          opened_at: "2026-05-09",
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await screen.findByText("Ada Rossi");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "client-1");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "counterparty-1");
    fireEvent.submit(screen.getByRole("button", { name: "Salva" }).closest("form")!);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Inserisci un numero pratica numerico positivo"),
    );
  });
});
