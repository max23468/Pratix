// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Route } from "./pratiche.$caseId";
import { routeComponent } from "./-route-test-utils";

const RouteComponent = routeComponent(Route);

const { caseRow } = vi.hoisted(() => ({
  caseRow: {
    id: "case-1",
    principal_id: "principal-1",
    client_id: "client-1",
    counterparty_id: "counterparty-1",
    practice_number: 108,
    case_number: "108",
    title: "Pratica 108",
    status: "in_progress",
    opened_at: "2026-05-01",
    closed_at: null,
    updated_at: "2026-05-07",
    authority: null,
    rg_number: null,
    notes: null,
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
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ caseId: "case-1" }),
  }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: [string, ...unknown[]] }) => {
    if (queryKey[0] === "case") {
      return { data: caseRow, isLoading: false };
    }

    return { data: [], isFetching: false, isLoading: false };
  },
}));

vi.mock("@/components/app-layout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/case-operations-panel", () => ({
  CaseOperationsPanel: ({
    afterDashboardSlot,
    detailsSlot,
  }: {
    afterDashboardSlot?: ReactNode;
    detailsSlot?: ReactNode;
  }) => (
    <section aria-label="pannello pratica">
      {afterDashboardSlot}
      {detailsSlot}
    </section>
  ),
}));

vi.mock("@/components/case-activities", () => ({
  CaseActivitiesTab: () => <p>Tab attività</p>,
}));

vi.mock("@/components/case-form", () => ({
  CaseForm: () => <p>Form pratica</p>,
}));

vi.mock("@/components/practices/credit-transfers-tab", () => ({
  CreditTransfersTab: () => <p>Cessioni credito</p>,
}));

vi.mock("@/components/practices/case-history-tab", () => ({
  HistoryTab: () => <p>Storico stati</p>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

describe("Dettaglio pratica", () => {
  it("renderizza l'intestazione della pratica caricata", () => {
    render(<RouteComponent />);

    expect(screen.getByRole("heading", { name: "Pratica 108" })).toBeTruthy();
    expect(screen.getByText("Banca Alfa · Mario Rossi · Beta S.r.l.")).toBeTruthy();
    expect(screen.getByText("Tab attività")).toBeTruthy();
    expect(screen.getByText("Form pratica")).toBeTruthy();
  });
});
