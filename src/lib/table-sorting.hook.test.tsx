// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authState, maybeSingle, upsert, supabase } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const upsert = vi.fn(async () => ({ error: null }));
  const authState: { session: { user: { id: string } } | null } = {
    session: { user: { id: "user-1" } },
  };
  const selectBuilder = {
    eq: vi.fn(() => selectBuilder),
    maybeSingle,
  };
  const tableBuilder = {
    select: vi.fn(() => selectBuilder),
    upsert,
  };
  return {
    authState,
    maybeSingle,
    upsert,
    supabase: {
      from: vi.fn(() => tableBuilder),
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}));

import { type SortableColumn, usePersistentTableSort } from "./table-sorting";

/** Forma di riga comune alle colonne di test. */
type SortTestRow = { name: string; amount: number };

const columns = [
  {
    key: "name",
    label: "Nome",
    getValue: (row: SortTestRow) => row.name,
  },
  {
    key: "amount",
    label: "Importo",
    valueType: "number" as const,
    defaultDirection: "desc" as const,
    getValue: (row: SortTestRow) => row.amount,
  },
] satisfies readonly SortableColumn<SortTestRow, "name" | "amount">[];

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function Probe({
  urlSort,
  onSortChange,
}: {
  urlSort?: { key: "name" | "amount"; direction: "asc" | "desc" };
  onSortChange: (sort: { key: "name" | "amount"; direction: "asc" | "desc" }) => void;
}) {
  const [controlledSort, setControlledSort] = useState(urlSort);
  const { sort, setSort } = usePersistentTableSort({
    section: "cases",
    columns,
    defaultSort: { key: "name", direction: "asc" },
    urlSort: controlledSort,
    onSortChange: (next) => {
      setControlledSort(next);
      onSortChange(next);
    },
  });

  return (
    <div>
      <div data-testid="sort">{`${sort.key}:${sort.direction}`}</div>
      <button type="button" onClick={() => setSort("name")}>
        name
      </button>
      <button type="button" onClick={() => setSort("amount")}>
        amount
      </button>
      <button type="button" onClick={() => setSort({ key: "amount", direction: "asc" })}>
        object
      </button>
      <button type="button" onClick={() => setSort("missing" as never)}>
        missing
      </button>
    </div>
  );
}

describe("usePersistentTableSort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.session = { user: { id: "user-1" } };
    maybeSingle.mockResolvedValue({ data: null, error: null });
    upsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("usa il sort salvato e alterna la direzione quando clicchi la stessa colonna", async () => {
    maybeSingle.mockResolvedValue({
      data: { sort_key: "amount", sort_direction: "desc" },
      error: null,
    });
    const onSortChange = vi.fn();

    renderWithClient(<Probe onSortChange={onSortChange} />);

    await waitFor(() => expect(screen.getByTestId("sort").textContent).toBe("amount:desc"));

    fireEvent.click(screen.getByRole("button", { name: "amount" }));

    await waitFor(() =>
      expect(onSortChange).toHaveBeenLastCalledWith({ key: "amount", direction: "asc" }),
    );
    await waitFor(() => expect(screen.getByTestId("sort").textContent).toBe("amount:asc"));
    expect(upsert).toHaveBeenLastCalledWith(
      {
        user_id: "user-1",
        section: "cases",
        sort_key: "amount",
        sort_direction: "asc",
      },
      { onConflict: "user_id,section" },
    );

    fireEvent.click(screen.getByRole("button", { name: "amount" }));

    await waitFor(() =>
      expect(onSortChange).toHaveBeenLastCalledWith({ key: "amount", direction: "desc" }),
    );
    await waitFor(() => expect(screen.getByTestId("sort").textContent).toBe("amount:desc"));
  });

  it("usa la direzione di default della nuova colonna, accetta setSort oggetto e ignora chiavi invalide", async () => {
    const onSortChange = vi.fn();

    renderWithClient(<Probe onSortChange={onSortChange} />);

    await waitFor(() => expect(screen.getByTestId("sort").textContent).toBe("name:asc"));

    fireEvent.click(screen.getByRole("button", { name: "amount" }));

    await waitFor(() =>
      expect(onSortChange).toHaveBeenLastCalledWith({ key: "amount", direction: "desc" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "object" }));

    await waitFor(() =>
      expect(onSortChange).toHaveBeenLastCalledWith({ key: "amount", direction: "asc" }),
    );

    const upsertCalls = upsert.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "missing" }));

    await waitFor(() => expect(upsert.mock.calls.length).toBe(upsertCalls));
  });

  it("usa urlSort come priorita rispetto al preferito salvato e salta la query senza sessione", async () => {
    maybeSingle.mockResolvedValue({
      data: { sort_key: "amount", sort_direction: "desc" },
      error: null,
    });
    const onSortChange = vi.fn();

    renderWithClient(
      <Probe urlSort={{ key: "name", direction: "desc" }} onSortChange={onSortChange} />,
    );

    await waitFor(() => expect(screen.getByTestId("sort").textContent).toBe("name:desc"));

    authState.session = null;
    cleanup();
    renderWithClient(<Probe onSortChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("sort").textContent).toBe("name:asc"));
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});
