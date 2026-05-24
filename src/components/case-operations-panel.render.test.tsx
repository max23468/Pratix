// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseOperationsPanel, type CaseOperationsCase } from "./case-operations-panel";

const queryDataByKey = vi.hoisted(() => new Map<string, unknown>());
const buildCaseDossierWorkbook = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: [string, ...unknown[]] }) => ({
    data: queryDataByKey.get(queryKey[0]) ?? [],
    isFetching: false,
    isLoading: false,
  }),
}));

vi.mock("@/components/case-activities", () => ({
  CaseActivityDialog: ({
    activity,
    trigger,
  }: {
    activity?: { description?: string } | null;
    trigger?: React.ReactNode;
  }) => (
    <div>
      {trigger}
      {activity ? <p>Dialog attività: {activity.description}</p> : null}
    </div>
  ),
}));

vi.mock("@/lib/case-dossier-xlsx", () => ({
  buildCaseDossierWorkbook,
}));

const createObjectURL = vi.fn(() => "blob:pratix-dossier");
const revokeObjectURL = vi.fn();
const anchorClick = vi.fn();

describe("CaseOperationsPanel", () => {
  beforeEach(() => {
    queryDataByKey.clear();
    buildCaseDossierWorkbook.mockReturnValue({
      bytes: new Uint8Array([1, 2, 3]),
      fileName: "dossier-pratica.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      value: anchorClick,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("rende cruscotto, controlli qualità, timeline e download del dossier", async () => {
    queryDataByKey.set("case-activities", [
      {
        id: "activity-1",
        case_id: "case-1",
        activity_date: "2026-05-03",
        kind: "fee",
        status: "to_invoice",
        needs_review: false,
        description: "Udienza",
        quantity: 1,
        unit_price: 120,
        amount: 120,
        notes: "Nota attività",
        case_activity_hearings: [{ id: "hearing-1", hearing_date: "2026-05-20", position: 1 }],
        activity_attachments: [{ id: "attachment-1", display_name: "Verbale.pdf" }],
      },
      {
        id: "activity-2",
        case_id: "case-1",
        activity_date: "2026-05-04",
        kind: "expense_reimbursement",
        status: "invoiced",
        needs_review: false,
        description: "Contributo unificato",
        quantity: 1,
        unit_price: 42,
        amount: 42,
        notes: null,
        case_activity_hearings: [],
        activity_attachments: [],
      },
    ]);
    queryDataByKey.set("case-invoices", [
      {
        id: "invoice-1",
        number: "TST1",
        year: 2026,
        issue_date: "2026-05-05",
        due_date: "2026-06-05",
        paid_at: null,
        status: "draft",
        total_amount: 42,
        notes: "Bozza da emettere",
      },
    ]);
    queryDataByKey.set("case-history", [
      {
        id: "history-1",
        changed_at: "2026-05-02",
        previous_status: "draft",
        new_status: "in_progress",
        note: "Avvio istruttoria",
      },
    ]);
    queryDataByKey.set("case-credit-transfers", [
      {
        id: "transfer-1",
        transferred_at: "2026-05-06",
        previous_client: {
          kind: "individual",
          first_name: "Mario",
          last_name: "Rossi",
          business_name: null,
        },
        new_client: {
          kind: "company",
          first_name: null,
          last_name: null,
          business_name: "Beta S.r.l.",
        },
      },
    ]);

    render(
      <CaseOperationsPanel
        caseRow={caseRow()}
        afterDashboardSlot={<p>Slot dopo cruscotto</p>}
        detailsSlot={<p>Form pratica sintetico</p>}
      />,
    );

    expect(screen.getByText("Azioni rapide pratica")).toBeTruthy();
    expect(screen.getByText("Cruscotto pratica")).toBeTruthy();
    expect(screen.getAllByText("Da fatturare").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Controlla le Attività da fatturare e prepara la prossima Fattura."),
    ).toBeTruthy();
    expect(screen.getByText("Slot dopo cruscotto")).toBeTruthy();
    expect(screen.getByText("Dati e riferimenti pratica")).toBeTruthy();
    expect(screen.getByText("Form pratica sintetico")).toBeTruthy();
    expect(screen.getByText("Controlli qualità dati")).toBeTruthy();
    expect(screen.getByText("Udienza")).toBeTruthy();
    expect(screen.getByText("Verbale.pdf")).toBeTruthy();
    expect(screen.getByText("Fattura TST1/2026")).toBeTruthy();
    expect(screen.getByText("In corso")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Modifica attività Udienza" }));
    expect(screen.getByText("Dialog attività: Udienza")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Dossier Excel" }));
    expect(buildCaseDossierWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceNumber: 108,
        principalName: "Banca Alfa",
        clientName: "Mario Rossi",
        counterpartyName: "Beta S.r.l.",
      }),
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pratix-dossier");
  });
});

function caseRow(): CaseOperationsCase {
  return {
    id: "case-1",
    principal_id: "principal-1",
    client_id: "client-1",
    counterparty_id: "counterparty-1",
    practice_number: 108,
    status: "in_progress",
    opened_at: "2026-05-01",
    closed_at: null,
    updated_at: "2026-05-07",
    authority: "Tribunale di Milano",
    rg_number: "123/2026",
    notes: "Nota pratica",
    principals: { business_name: "Banca Alfa" },
    clients: {
      kind: "individual",
      first_name: "Mario",
      last_name: "Rossi",
      business_name: null,
    },
    counterparties: {
      kind: "company",
      first_name: null,
      last_name: null,
      business_name: "Beta S.r.l.",
    },
  };
}
