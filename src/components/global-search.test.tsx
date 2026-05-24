// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "./global-search";

const navigateMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ user: { id: "user-1" } as { id: string } | null }));
const supabaseMock = vi.hoisted(() => {
  const tableRows = new Map<string, unknown[]>();
  const builders: Array<{ table: string; builder: Record<string, unknown> }> = [];

  const createBuilder = (table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
        Promise.resolve({ data: tableRows.get(table) ?? [], error: null }).then(resolve, reject),
    };
    builders.push({ table, builder });
    return builder;
  };

  return {
    tableRows,
    builders,
    supabase: {
      from: vi.fn((table: string) => createBuilder(table)),
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock.supabase,
}));

vi.mock("@tanstack/react-query", async () => {
  const React = await import("react");
  return {
    useQuery: ({
      enabled,
      queryKey,
      queryFn,
    }: {
      enabled: boolean;
      queryKey: unknown[];
      queryFn: () => Promise<unknown[]>;
    }) => {
      const [state, setState] = React.useState({ data: [] as unknown[], isFetching: false });
      const stableKey = JSON.stringify(queryKey);
      const queryFnRef = React.useRef(queryFn);

      React.useEffect(() => {
        queryFnRef.current = queryFn;
      }, [queryFn]);

      React.useEffect(() => {
        let active = true;
        if (!enabled) {
          setState({ data: [], isFetching: false });
          return () => {
            active = false;
          };
        }

        setState({ data: [], isFetching: true });
        void queryFnRef.current().then((data) => {
          if (active) setState({ data, isFetching: false });
        });
        return () => {
          active = false;
        };
      }, [enabled, stableKey]);

      return state;
    },
  };
});

vi.mock("@/components/ui/command", () => ({
  CommandDialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <dialog open>{children}</dialog> : null,
  CommandEmpty: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CommandGroup: ({ children, heading }: { children: ReactNode; heading: string }) => (
    <section aria-label={heading}>
      <h2>{heading}</h2>
      {children}
    </section>
  ),
  CommandInput: ({
    placeholder,
    value,
    onValueChange,
  }: {
    placeholder: string;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <input
      aria-label={placeholder}
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    />
  ),
  CommandItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandSeparator: () => <hr />,
}));

describe("GlobalSearch", () => {
  beforeEach(() => {
    authState.user = { id: "user-1" };
    navigateMock.mockReset();
    supabaseMock.tableRows.clear();
    supabaseMock.builders.length = 0;
    supabaseMock.supabase.from.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("apre la palette, gestisce scorciatoie e naviga sulle azioni rapide", async () => {
    render(<GlobalSearch />);

    fireEvent.keyDown(window, { key: "p", shiftKey: true, metaKey: true });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/pratiche/nuova" });
    fireEvent.keyDown(window, { key: "c", shiftKey: true, ctrlKey: true });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/clienti/nuovo" });
    fireEvent.keyDown(window, { key: "f", shiftKey: true, metaKey: true });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/fatture/nuova" });

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /Controllo duplicati/ }));
    expect(navigateMock).toHaveBeenLastCalledWith({ to: "/controllo-duplicati" });
  });

  it("cerca risultati Supabase, raggruppa le entità e apre le route corrette", async () => {
    supabaseMock.tableRows.set("cases", [
      {
        id: "case-1",
        public_code: "PR-000108",
        practice_number: 108,
        updated_at: "2026-05-22",
      },
    ]);
    supabaseMock.tableRows.set("clients", [
      {
        id: "client-1",
        public_code: "CL-000001",
        kind: "individual",
        first_name: "Mario",
        last_name: "Rossi",
        business_name: null,
        created_at: "2026-05-22",
      },
    ]);
    supabaseMock.tableRows.set("principals", [
      {
        id: "principal-1",
        public_code: "CM-000001",
        business_name: "Banca Alfa",
        email: "alfa@example.test",
        pec: null,
        vat_number: "123",
        created_at: "2026-05-22",
      },
    ]);
    supabaseMock.tableRows.set("counterparties", [
      {
        id: "counterparty-1",
        public_code: "CP-000001",
        kind: "company",
        first_name: null,
        last_name: null,
        business_name: "Beta S.r.l.",
        notes: "Debitore",
        updated_at: "2026-05-22",
      },
    ]);
    supabaseMock.tableRows.set("case_activities", [
      {
        id: "activity-1",
        activity_date: "2026-05-21",
        kind: "fee",
        status: "to_invoice",
        description: "Udienza di precisazione",
        snapshot_price_name: "Udienza",
        amount: 120,
        cases: { id: "case-1", public_code: "PR-000108", practice_number: 108 },
      },
    ]);
    supabaseMock.tableRows.set("invoices", [
      {
        id: "invoice-1",
        public_code: "FT-000001",
        number: "TST1",
        year: 2026,
        status: "draft",
        total_amount: 120,
        issue_date: "2026-05-22",
        principal: { business_name: "Banca Alfa" },
        client: null,
      },
    ]);

    render(<GlobalSearch />);

    await userEvent.click(screen.getByRole("button", { name: "Ricerca" }));
    await userEvent.type(
      screen.getByLabelText(
        "Cerca pratiche, committenti, clienti, controparti, attività o fatture",
      ),
      "TST,_%",
    );

    expect(await screen.findByText("Pratica 108")).toBeTruthy();
    expect(screen.getByText("Banca Alfa")).toBeTruthy();
    expect(screen.getByText("Mario Rossi")).toBeTruthy();
    expect(screen.getByText("Beta S.r.l.")).toBeTruthy();
    expect(screen.getByText("Udienza di precisazione")).toBeTruthy();
    expect(screen.getByText("Fattura TST1/2026")).toBeTruthy();

    await waitFor(() => {
      const caseBuilders = supabaseMock.builders.filter((entry) => entry.table === "cases");
      expect(caseBuilders.some(({ builder }) => vi.mocked(builder.or).mock.calls.length > 0)).toBe(
        true,
      );
    });
    const filteredCaseTerms = supabaseMock.builders
      .filter((entry) => entry.table === "cases")
      .flatMap(({ builder }) => vi.mocked(builder.or).mock.calls.map((call) => String(call[0])));
    expect(
      filteredCaseTerms.some(
        (term) => term.includes("\\_") && term.includes("\\%") && !term.includes(","),
      ),
    ).toBe(true);

    await selectResult("Pratiche", /Pratica 108/);
    expect(navigateMock).toHaveBeenLastCalledWith({
      to: "/pratiche/$caseId",
      params: { caseId: "PR-000108" },
    });

    await selectResult("Committenti", /Banca Alfa/);
    expect(navigateMock).toHaveBeenLastCalledWith({
      to: "/committenti/$principalId",
      params: { principalId: "CM-000001" },
    });

    await selectResult("Clienti", /Mario Rossi/);
    expect(navigateMock).toHaveBeenLastCalledWith({
      to: "/clienti/$clientId",
      params: { clientId: "CL-000001" },
    });

    await selectResult("Controparti", /Beta S\.r\.l\./);
    expect(navigateMock).toHaveBeenLastCalledWith({
      to: "/controparti/$counterpartyId",
      params: { counterpartyId: "CP-000001" },
    });

    await selectResult("Attività", /Udienza di precisazione/);
    expect(navigateMock).toHaveBeenLastCalledWith({
      to: "/attivita",
      search: { q: "Udienza di precisazione" },
    });

    await selectResult("Fatture", /Fattura TST1\/2026/);
    expect(navigateMock).toHaveBeenLastCalledWith({
      to: "/fatture/$invoiceId",
      params: { invoiceId: "FT-000001" },
    });
  });
});

async function selectResult(group: string, name: RegExp) {
  await userEvent.click(screen.getByRole("button", { name: "Ricerca" }));
  const groupRegion = await screen.findByLabelText(group);
  await userEvent.click(within(groupRegion).getByRole("button", { name }));
}
