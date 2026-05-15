// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaseActivitiesTab } from "./case-activities";

const { toast, supabase, deleteQuery, storage } = vi.hoisted(() => {
  const deleteQuery = {
    eq: vi.fn(() => Promise.resolve({ error: null })),
  };
  const storage = {
    remove: vi.fn(() => Promise.resolve({ error: null })),
    createSignedUrl: vi.fn(() =>
      Promise.resolve({
        data: { signedUrl: "https://signed.example.test/documento.pdf" },
        error: null,
      }),
    ),
  };
  return {
    toast: { success: vi.fn(), error: vi.fn() },
    deleteQuery,
    storage,
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        delete: vi.fn(() => deleteQuery),
      })),
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

const activities = [
  {
    id: "activity-1",
    activity_date: "2026-05-09",
    kind: "fee",
    status: "to_invoice",
    snapshot_price_code: "COMP_PIGN_MOB_TERZI_RUOLO",
    snapshot_price_name: "Udienza",
    description: "Partecipazione udienza",
    quantity: 2,
    unit_price: 120,
    amount: 240,
    invoice_id: null,
    notes: "Note attività",
    case_activity_hearings: [
      { id: "h-2", hearing_date: "2026-05-20", position: 20, notes: null },
      { id: "h-1", hearing_date: "2026-05-10", position: 10, notes: null },
    ],
    activity_attachments: [
      {
        id: "att-1",
        storage_path: "user-test/activity-1/documento.pdf",
        display_name: "Documento",
        document_type: "PDF",
        original_file_name: "documento.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
        notes: "Allegato test",
        preview_available: true,
      },
    ],
  },
  {
    id: "activity-2",
    activity_date: "2026-05-11",
    kind: "expense_reimbursement",
    status: "invoiced",
    snapshot_price_code: "RIMB_PIGNORAMENTO",
    snapshot_price_name: "Contributo unificato",
    description: "Contributo unificato",
    quantity: 1,
    unit_price: 118.5,
    amount: 118.5,
    invoice_id: "invoice-1",
    notes: null,
    case_activity_hearings: [],
    activity_attachments: [],
  },
];

const clientWithActivities = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(["case-activities", "case-1"], activities);
  return client;
};

describe("CaseActivitiesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    cleanup();
    vi.mocked(window.open).mockRestore();
  });

  it("renderizza riepilogo, righe attività, udienze e allegati", () => {
    const client = clientWithActivities();

    const html = renderToString(
      <QueryClientProvider client={client}>
        <CaseActivitiesTab caseRow={caseRow} />
      </QueryClientProvider>,
    );

    expect(html).toContain("Partecipazione udienza");
    expect(html).toContain("Contributo unificato");
    expect(html).toContain("Documento");
    expect(html).toContain("Da fatturare");
    expect(html).toContain("Fatturata");
    expect(html).not.toContain("COMP_PIGN_MOB_TERZI_RUOLO");
    expect(html).not.toContain("RIMB_PIGNORAMENTO");
  });

  it("apre allegati e rimuove una voce non fatturata con file collegato", async () => {
    const client = clientWithActivities();
    render(
      <QueryClientProvider client={client}>
        <CaseActivitiesTab caseRow={caseRow} />
      </QueryClientProvider>,
    );

    const activityRow = screen.getByText("Partecipazione udienza").closest("tr")!;
    const attachmentButtons = screen
      .getByText("Documento")
      .parentElement!.querySelectorAll("button");
    const rowButtons = within(activityRow).getAllByRole("button");

    await userEvent.click(attachmentButtons[0]);
    await waitFor(() =>
      expect(storage.createSignedUrl).toHaveBeenCalledWith(
        "user-test/activity-1/documento.pdf",
        60,
        undefined,
      ),
    );
    expect(window.open).toHaveBeenCalledWith(
      "https://signed.example.test/documento.pdf",
      "_blank",
      "noopener,noreferrer",
    );

    await userEvent.click(rowButtons.at(-1)!);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Voce eliminata"));
    expect(storage.remove).toHaveBeenCalledWith(["user-test/activity-1/documento.pdf"]);
    expect(deleteQuery.eq).toHaveBeenCalledWith("id", "activity-1");
  });
});
