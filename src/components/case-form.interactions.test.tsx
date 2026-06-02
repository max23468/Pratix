// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findDuplicates, toast, supabase, query, single } = vi.hoisted(() => {
  const findDuplicates = vi.fn();
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
    upsert: vi.fn(() => query),
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
      upsert: vi.fn((...args: unknown[]) => {
        query.upsert(...args);
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
    findDuplicates,
    toast: { success: vi.fn(), error: vi.fn() },
    query,
    single,
    supabase: {
      from: vi.fn((table: string) => builderFor(table)),
      rpc: vi.fn(() => Promise.resolve({ data: 157, error: null })),
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: "token-test" } },
        })),
      },
    },
  };
});

let activeBlocker: { blockerFn: () => boolean | Promise<boolean> } | null = null;
const unsavedState = vi.hoisted(() => ({
  dirty: false,
  skipNextBlock: false,
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/components/unsaved-changes-guard", () => ({
  useUnsavedChangesGuard: () => {
    activeBlocker = {
      blockerFn: () => {
        if (unsavedState.skipNextBlock) {
          unsavedState.skipNextBlock = false;
          return false;
        }
        return unsavedState.dirty;
      },
    };

    return {
      finishSave: () => {
        unsavedState.dirty = false;
        unsavedState.skipNextBlock = true;
      },
      formRef: { current: null },
      guardDialog: null,
      markDirty: () => {
        unsavedState.dirty = true;
      },
    };
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    useServerFn: () => findDuplicates,
  };
});

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
import { buildCandidate } from "@/lib/duplicate-matching";

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
    unsavedState.dirty = false;
    unsavedState.skipNextBlock = false;
    findDuplicates.mockReset();
    findDuplicates.mockResolvedValue([]);
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
    fireEvent.change(screen.getByLabelText("Nome committente"), {
      target: { value: " Nuovo Mandante " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Committente creato"));

    await userEvent.click(screen.getAllByRole("button", { name: /Nuovo/ })[1]);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "individual");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: " Ada " } });
    fireEvent.change(screen.getByLabelText("Cognome"), { target: { value: " Verdi " } });
    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cliente creato"));

    await userEvent.click(screen.getByRole("button", { name: /Nuova/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[3], "company");
    fireEvent.change(screen.getByLabelText("Ragione sociale"), {
      target: { value: " Beta Debitrice " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Controparte creata"));
    await waitFor(() =>
      expect((screen.getAllByRole("combobox")[2] as HTMLSelectElement).value).toBe(
        "counterparty-new",
      ),
    );
    expect(screen.getByRole("option", { name: "Beta Debitrice" })).toBeTruthy();

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

  it("crea rapidamente una controparte composta con più soggetti", async () => {
    single.mockResolvedValueOnce({ data: { id: "counterparty-group" }, error: null });

    render(<CaseForm onSaved={vi.fn()} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");

    await userEvent.click(screen.getByRole("button", { name: /Nuova/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[3], "group");
    fireEvent.change(screen.getByLabelText("Nome controparte composta"), {
      target: { value: " Debitori gruppo " },
    });

    expect(screen.getByText("Soggetti della controparte")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Cognome"), { target: { value: " Rossi " } });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: " Mario " } });
    fireEvent.change(screen.getAllByLabelText("Note")[0], { target: { value: " Garante " } });

    await userEvent.click(screen.getByRole("button", { name: /Soggetto/ }));
    const subjectKindSelects = screen.getAllByRole("combobox").filter((element) => {
      const values = Array.from((element as HTMLSelectElement).options).map(
        (option) => option.value,
      );
      return (
        values.includes("individual") && values.includes("company") && !values.includes("group")
      );
    });
    await userEvent.selectOptions(subjectKindSelects[subjectKindSelects.length - 1], "company");
    fireEvent.change(screen.getByLabelText("Ragione sociale"), {
      target: { value: " Gamma S.r.l. " },
    });

    await userEvent.click(screen.getByRole("button", { name: "Crea" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Controparte creata"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-test",
        kind: "group",
        first_name: null,
        last_name: null,
        business_name: "Debitori gruppo",
      }),
    );
    expect(query.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: "user-test",
        counterparty_id: "counterparty-group",
        kind: "individual",
        first_name: "Mario",
        last_name: "Rossi",
        business_name: null,
        notes: "Garante",
        position: 0,
      }),
      expect.objectContaining({
        user_id: "user-test",
        counterparty_id: "counterparty-group",
        kind: "company",
        first_name: null,
        last_name: null,
        business_name: "Gamma S.r.l.",
        position: 1,
      }),
    ]);
    await waitFor(() =>
      expect((screen.getAllByRole("combobox")[2] as HTMLSelectElement).value).toBe(
        "counterparty-group",
      ),
    );
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

  it("mostra duplicati sulla pratica e permette di usare subito quella esistente", async () => {
    const onSaved = vi.fn();
    findDuplicates.mockResolvedValueOnce([
      buildCandidate({
        entityType: "case",
        left: {
          id: "case-existing",
          publicCode: "PRA-77",
          label: "Pratica 77",
          subtitle: "Banca Test · Ada Rossi",
        },
        right: {
          id: "draft-case",
          label: "Nuova pratica",
        },
        score: 0.93,
        reasons: ["Numero pratica uguale", "Stesso committente"],
      }),
    ]);

    render(<CaseForm onSaved={onSaved} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Ada Rossi");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "client-1");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "counterparty-1");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Controlla i potenziali duplicati prima di creare la pratica",
      ),
    );
    expect(query.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ principal_id: "principal-1" }),
    );
    expect(screen.getByText(/Potrebbe già esistere/)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Usa esistente" }));

    expect(onSaved).toHaveBeenCalledWith("PRA-77");
    expect(findDuplicates).toHaveBeenCalledTimes(1);
  });

  it("permette di creare comunque la pratica dopo il warning duplicati", async () => {
    findDuplicates.mockResolvedValueOnce([
      buildCandidate({
        entityType: "case",
        left: {
          id: "case-existing",
          label: "Pratica 157",
        },
        right: {
          id: "draft-case",
          label: "Nuova pratica",
        },
        score: 0.9,
        reasons: ["Numero pratica uguale"],
      }),
    ]);

    render(<CaseForm onSaved={vi.fn()} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");
    await screen.findByText("Ada Rossi");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "client-1");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "counterparty-1");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Controlla i potenziali duplicati prima di creare la pratica",
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "Crea comunque" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pratica creata"));
    expect(findDuplicates).toHaveBeenCalledTimes(1);
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        principal_id: "principal-1",
        client_id: "client-1",
        counterparty_id: "counterparty-1",
        practice_number: 157,
      }),
    );
  });

  it("collega un cliente esistente quando la creazione rapida trova un duplicato", async () => {
    findDuplicates.mockResolvedValueOnce([
      buildCandidate({
        entityType: "client",
        left: {
          id: "client-existing",
          label: "Alfa S.r.l.",
        },
        right: {
          id: "draft-client",
          label: "Alfa S.r.l.",
        },
        score: 0.88,
        reasons: ["Ragione sociale molto simile"],
      }),
    ]);

    render(<CaseForm onSaved={vi.fn()} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "principal-1");

    await userEvent.click(screen.getAllByRole("button", { name: /Nuovo/ })[1]);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "company");
    fireEvent.change(screen.getByLabelText("Ragione sociale"), {
      target: { value: " Alfa S.r.l. " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Crea" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Controlla i potenziali duplicati prima di creare il cliente",
      ),
    );
    expect(screen.getAllByText("Alfa S.r.l.").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Usa esistente" }));

    await waitFor(() =>
      expect(query.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-test",
          principal_id: "principal-1",
          client_id: "client-existing",
          active_from: expect.any(String),
        }),
        expect.objectContaining({
          onConflict: "user_id,principal_id,client_id",
        }),
      ),
    );
    expect((screen.getAllByRole("combobox")[1] as HTMLSelectElement).value).toBe("client-existing");
  });

  it("ripristina un soggetto vuoto quando rimuovi l'unico elemento di una controparte composta", async () => {
    render(<CaseForm onSaved={vi.fn()} onCancel={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByText("Banca Test");
    await userEvent.click(screen.getByRole("button", { name: /Nuova/ }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[3], "group");

    fireEvent.change(screen.getByLabelText("Cognome"), { target: { value: "Rossi" } });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Mario" } });

    await userEvent.click(screen.getByRole("button", { name: /Rimuovi/ }));

    expect(screen.getByText("Soggetto 1")).toBeTruthy();
    expect((screen.getByLabelText("Cognome") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("");
  });
});
