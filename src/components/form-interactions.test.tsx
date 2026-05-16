// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientForm } from "./client-form";
import { CounterpartyForm } from "./counterparty-form";
import { PriceBookForm } from "./price-book-form";
import { PrincipalForm } from "./principal-form";

const { toast, supabase, query, single, maybeSingle } = vi.hoisted(() => {
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  };
  const single = vi.fn();
  const maybeSingle = vi.fn();
  const queryData = (table: string) => {
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
        ],
        error: null,
      };
    }
    if (table === "principals") {
      return {
        data: [
          {
            id: "principal-1",
            business_name: "Banca Test",
            fees_enabled: true,
            expense_reimbursements_enabled: true,
            archived_at: null,
          },
        ],
        error: null,
      };
    }
    if (table === "principal_clients") {
      return { data: [{ client_id: "client-1", principal_id: "principal-1" }], error: null };
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
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    single,
    maybeSingle,
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
      in: vi.fn((...args: unknown[]) => {
        query.in(...args);
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
      maybeSingle,
      then: (
        onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
        onrejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(queryData(table)).then(onfulfilled, onrejected),
    };
    return builder;
  };
  const supabase = {
    from: vi.fn((table: string) => builderFor(table)),
  };
  return { toast, supabase, query, single, maybeSingle };
});

vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

const renderWithClient = (node: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe("interazioni form anagrafiche", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    single.mockResolvedValue({ data: { id: "saved-id", archived_at: null }, error: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("valida e salva un committente con payload normalizzato", async () => {
    const onSaved = vi.fn();
    renderWithClient(
      <PrincipalForm
        initial={{
          id: "principal-1",
          business_name: " Banca Test ",
          tax_code: " abc ",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          archived_at: null,
        }}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Committente aggiornato"));
    expect(supabase.from).toHaveBeenCalledWith("principals");
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: "Banca Test",
        tax_code: "abc",
        user_id: "user-test",
      }),
    );
    expect(onSaved).toHaveBeenCalledWith("saved-id");
  });

  it("archivia e riattiva un committente esistente", async () => {
    renderWithClient(
      <PrincipalForm
        initial={{
          id: "principal-1",
          business_name: "Banca Test",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          archived_at: null,
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    single.mockResolvedValueOnce({
      data: { id: "principal-1", archived_at: "2026-05-09T10:00:00.000Z" },
      error: null,
    });
    await userEvent.click(screen.getByRole("button", { name: "Archivia" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Committente archiviato"));
    expect(query.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });

    cleanup();
    vi.clearAllMocks();
    single.mockResolvedValueOnce({ data: { id: "principal-1", archived_at: null }, error: null });

    renderWithClient(
      <PrincipalForm
        initial={{
          id: "principal-1",
          business_name: "Banca Test",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          archived_at: "2026-05-09T10:00:00.000Z",
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Riattiva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Committente riattivato"));
    expect(query.update).toHaveBeenCalledWith({ archived_at: null });
  });

  it("blocca committente senza ragione sociale e cliente persona fisica senza nome", async () => {
    renderWithClient(<PrincipalForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Inserisci la ragione sociale"));

    renderWithClient(<ClientForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Salva" }).at(-1)!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Inserisci nome e cognome"));
  });

  it("blocca committente senza regole economiche abilitate", async () => {
    renderWithClient(
      <PrincipalForm
        initial={{
          business_name: "Banca Test",
          fees_enabled: false,
          expense_reimbursements_enabled: false,
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: "Salva" }).closest("form")!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Abilita almeno compensi o rimborsi spese"),
    );
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("crea un cliente con campi normalizzati", async () => {
    const onSaved = vi.fn();
    renderWithClient(
      <ClientForm
        initial={{
          first_name: " Ada ",
          last_name: " Rossi ",
          tax_code: " rssdaa80a01h501a ",
          email: " ada@example.test ",
          sdi_code: "abcdefg",
        }}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByText("Banca Test");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cliente creato"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Ada",
        last_name: "Rossi",
        tax_code: "rssdaa80a01h501a",
        email: "ada@example.test",
        sdi_code: "abcdefg",
      }),
    );
    expect(query.delete).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith("saved-id");
  });

  it("blocca il salvataggio del cliente senza committente collegato", async () => {
    renderWithClient(
      <ClientForm
        initial={{
          first_name: "Ada",
          last_name: "Rossi",
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByText("Banca Test");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Collega il cliente ad almeno un committente"),
    );
    expect(screen.getByText("Committente obbligatorio")).toBeTruthy();
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("ignora submit cliente ripetuti mentre il salvataggio è in corso", async () => {
    renderWithClient(
      <ClientForm
        initial={{
          first_name: " Ada ",
          last_name: " Rossi ",
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByText("Banca Test");
    await userEvent.click(screen.getByRole("checkbox"));
    const form = screen.getByRole("button", { name: "Salva" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cliente creato"));
    expect(query.insert).toHaveBeenCalledTimes(2);
  });

  it("crea cliente società collegandolo ai committenti selezionati", async () => {
    const onSaved = vi.fn();
    renderWithClient(
      <ClientForm
        initial={{
          kind: "company",
          business_name: " Alfa S.r.l. ",
          vat_number: " 12345678901 ",
        }}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByText("Banca Test");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cliente creato"));
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "company",
        business_name: "Alfa S.r.l.",
        vat_number: "12345678901",
      }),
    );
    expect(query.insert).toHaveBeenCalledWith([
      {
        user_id: "user-test",
        client_id: "saved-id",
        principal_id: "principal-1",
      },
    ]);
    expect(onSaved).toHaveBeenCalledWith("saved-id");
  });

  it("ignora submit committente ripetuti mentre il salvataggio è in corso", async () => {
    renderWithClient(
      <PrincipalForm
        initial={{ business_name: " Banca Test " }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const form = screen.getByRole("button", { name: "Salva" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Committente creato"));
    expect(query.insert).toHaveBeenCalledTimes(1);
  });

  it("blocca cliente società senza ragione sociale", async () => {
    renderWithClient(
      <ClientForm initial={{ kind: "company" }} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Inserisci la ragione sociale"));
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("blocca controparte senza denominazione e salva gruppo con soggetti filtrati", async () => {
    renderWithClient(<CounterpartyForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Inserisci la ragione sociale o il nome del gruppo"),
    );
    cleanup();
    vi.clearAllMocks();
    single.mockResolvedValue({ data: { id: "counterparty-1" }, error: null });

    const onSaved = vi.fn();
    renderWithClient(
      <CounterpartyForm
        initial={{
          id: "counterparty-1",
          kind: "group",
          business_name: " Debitori collegati ",
          notes: " note gruppo ",
        }}
        initialSubjects={[
          {
            id: "subject-1",
            kind: "individual",
            first_name: " Luca ",
            last_name: " Bianchi ",
            business_name: null,
            notes: " garante ",
            position: 10,
          },
          {
            kind: "company",
            first_name: null,
            last_name: null,
            business_name: "",
            notes: "",
            position: 20,
          },
        ]}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Controparte aggiornata"));
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: "Debitori collegati",
        notes: "note gruppo",
      }),
    );
    expect(query.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        first_name: "Luca",
        last_name: "Bianchi",
        notes: "garante",
        position: 0,
      }),
    ]);
    expect(onSaved).toHaveBeenCalledWith("counterparty-1");
  });

  it("salva controparte persona fisica eliminando eventuali soggetti collegati", async () => {
    const onSaved = vi.fn();
    single.mockResolvedValue({ data: { id: "counterparty-1" }, error: null });

    renderWithClient(
      <CounterpartyForm
        initial={{
          id: "counterparty-1",
          kind: "individual",
          first_name: " Luca ",
          last_name: " Bianchi ",
          notes: " nota ",
        }}
        initialSubjects={[
          {
            id: "subject-1",
            kind: "company",
            first_name: null,
            last_name: null,
            business_name: "Società collegata",
            notes: null,
            position: 0,
          },
        ]}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Controparte aggiornata"));
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Luca",
        last_name: "Bianchi",
        business_name: null,
      }),
    );
    expect(query.delete).toHaveBeenCalled();
    expect(query.insert).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith("counterparty-1");
  });

  it("ignora submit controparte ripetuti mentre il salvataggio è in corso", async () => {
    renderWithClient(
      <CounterpartyForm
        initial={{ kind: "company", business_name: " Beta S.p.A. " }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const form = screen.getByRole("button", { name: "Salva" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Controparte creata"));
    expect(query.insert).toHaveBeenCalledTimes(1);
  });

  it("valida Prezzi senza committente e intercetta codici duplicati", async () => {
    renderWithClient(<PriceBookForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Seleziona un committente"));
    cleanup();
    vi.clearAllMocks();

    renderWithClient(
      <PriceBookForm
        initial={{
          id: "price-book-1",
          principal_id: "principal-1",
          year: 2026,
          status: "draft",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          valid_from: "2026-01-01",
          valid_to: null,
          notes: null,
        }}
        initialItems={[
          {
            kind: "fee",
            code: "DUP",
            name: "Prima voce",
            invoice_description: null,
            unit_price: 10,
            requires_hearing_dates: false,
          },
          {
            kind: "expense_reimbursement",
            code: "DUP",
            name: "Seconda voce",
            invoice_description: null,
            unit_price: null,
            requires_hearing_dates: false,
          },
        ]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Codice duplicato: DUP"));
  });

  it("valida Prezzi con anno fuori range, regole disabilitate e importo negativo", async () => {
    renderWithClient(
      <PriceBookForm
        initial={{
          principal_id: "principal-1",
          year: 1999,
          status: "draft",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          valid_from: "1999-01-01",
          valid_to: "1999-12-31",
          notes: null,
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: "Salva" }).closest("form")!);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Inserisci un anno valido"));
    cleanup();
    vi.clearAllMocks();

    renderWithClient(
      <PriceBookForm
        initial={{
          id: "price-book-1",
          principal_id: "principal-1",
          year: 2026,
          status: "draft",
          fees_enabled: false,
          expense_reimbursements_enabled: false,
          valid_from: "2026-01-01",
          valid_to: "2026-12-31",
          notes: null,
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Abilita almeno compensi o rimborsi spese"),
    );
    cleanup();
    vi.clearAllMocks();

    renderWithClient(
      <PriceBookForm
        initial={{
          id: "price-book-1",
          principal_id: "principal-1",
          year: 2026,
          status: "draft",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          valid_from: "2026-01-01",
          valid_to: null,
          notes: null,
        }}
        initialItems={[
          {
            kind: "fee",
            code: "NEG",
            name: "Voce negativa",
            invoice_description: null,
            unit_price: -1,
            requires_hearing_dates: false,
          },
        ]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: "Salva" }).closest("form")!);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Inserisci un prezzo valido per NEG"),
    );
  });

  it("aggiorna Prezzi sincronizzando voci esistenti e nuove", async () => {
    const onSaved = vi.fn();
    renderWithClient(
      <PriceBookForm
        initial={{
          id: "price-book-1",
          principal_id: "principal-1",
          year: 2026,
          status: "active",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          valid_from: "2026-01-01",
          valid_to: "2026-12-31",
          notes: " Note prezzi ",
        }}
        initialItems={[
          {
            id: "item-1",
            kind: "fee",
            code: " DIFF ",
            name: " Diffida ",
            invoice_description: "",
            unit_price: 120,
            is_enabled: true,
            requires_hearing_dates: false,
            sort_order: 10,
          },
          {
            kind: "expense_reimbursement",
            code: " CU ",
            name: " Contributo unificato ",
            invoice_description: " ",
            unit_price: null,
            is_enabled: true,
            requires_hearing_dates: true,
            sort_order: 20,
          },
        ]}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Prezzi aggiornati"));
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        principal_id: "principal-1",
        notes: "Note prezzi",
      }),
    );
    expect(query.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        code: "CU",
        name: "Contributo unificato",
        invoice_description: "Contributo unificato",
        requires_hearing_dates: false,
      }),
    ]);
    expect(onSaved).toHaveBeenCalledWith("saved-id");
  });

  it("ignora submit Prezzi ripetuti mentre il salvataggio è in corso", async () => {
    renderWithClient(
      <PriceBookForm
        initial={{
          principal_id: "principal-1",
          year: 2026,
          status: "draft",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          valid_from: "2026-01-01",
          valid_to: "2026-12-31",
          notes: null,
        }}
        initialItems={[
          {
            kind: "fee",
            code: "DIFF",
            name: "Diffida",
            invoice_description: null,
            unit_price: 120,
            is_enabled: true,
            requires_hearing_dates: false,
            sort_order: 10,
          },
        ]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const form = screen.getByRole("button", { name: "Salva" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Prezzi creati"));
    expect(query.insert).toHaveBeenCalledTimes(2);
  });
});
