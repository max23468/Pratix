import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CaseActivitiesTab } from "./case-activities";
import { CaseForm } from "./case-form";
import { ClientForm } from "./client-form";
import { CounterpartyForm } from "./counterparty-form";
import { InvoiceForm } from "./invoice-form";
import { PriceBookForm } from "./price-book-form";
import { PrincipalForm } from "./principal-form";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => null,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(),
}));

vi.mock("@/server/invoices.functions", () => ({
  createBillingInvoiceFn: {},
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

const renderWithQueryClient = (node: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return renderToString(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

const noop = () => {};

describe("form applicative principali", () => {
  it("renderizza la form Committente con regole economiche e stato archivio", () => {
    const html = renderWithQueryClient(
      <PrincipalForm
        initial={{
          id: "principal-1",
          business_name: "Banca Test",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          archived_at: null,
        }}
        onSaved={noop}
        onCancel={noop}
      />,
    );

    expect(html).toContain("Ragione sociale");
    expect(html).toContain("Regole economiche");
    expect(html).toContain("Compensi");
    expect(html).toContain("Rimborsi spese");
  });

  it("renderizza la form Cliente con anagrafica persona fisica", () => {
    const html = renderWithQueryClient(
      <ClientForm
        initial={{
          id: "client-1",
          kind: "individual",
          first_name: "Ada",
          last_name: "Rossi",
          business_name: null,
        }}
        onSaved={noop}
        onCancel={noop}
      />,
    );

    expect(html).toContain("Tipo cliente");
    expect(html).toContain("Nome");
    expect(html).toContain("Cognome");
    expect(html).toContain("Contatti");
    expect(html).not.toContain("Codice fiscale");
  });

  it("renderizza la form Controparte gruppo con soggetti multipli", () => {
    const html = renderWithQueryClient(
      <CounterpartyForm
        initial={{
          id: "counterparty-1",
          kind: "group",
          business_name: "Debitori collegati",
        }}
        initialSubjects={[
          {
            id: "subject-1",
            kind: "individual",
            first_name: "Luca",
            last_name: "Bianchi",
            business_name: null,
            notes: "Garante",
            position: 10,
          },
        ]}
        onSaved={noop}
        onCancel={noop}
      />,
    );

    expect(html).toContain("Tipo controparte");
    expect(html).toContain("Debitori collegati");
    expect(html).toContain("Soggetti della controparte");
  });

  it("renderizza la form Pratica con dati recupero crediti", () => {
    const html = renderWithQueryClient(
      <CaseForm
        initial={{
          id: "case-1",
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-1",
          practice_number: 42,
          case_number: "42",
          title: "Recupero fattura",
          matter: "civile",
          status: "open",
          opened_at: "2026-05-09",
        }}
        onSaved={noop}
        onCancel={noop}
      />,
    );

    expect(html).toContain("Numero pratica");
    expect(html).toContain("Recupero fattura");
    expect(html).toContain("Autorità");
  });

  it("renderizza la form Prezzi con voci compenso e rimborso spese", () => {
    const html = renderWithQueryClient(
      <PriceBookForm
        initial={{
          id: "price-book-1",
          principal_id: "principal-1",
          year: 2026,
          status: "active",
          fees_enabled: true,
          expense_reimbursements_enabled: true,
          valid_from: "2026-01-01",
          valid_to: null,
          notes: null,
        }}
        initialItems={[
          {
            id: "price-item-1",
            kind: "fee",
            code: "DIFFIDA",
            name: "Diffida",
            invoice_description: "Redazione diffida",
            unit_price: 120,
            requires_hearing_dates: false,
            sort_order: 10,
          },
          {
            id: "price-item-2",
            kind: "expense_reimbursement",
            code: "CU",
            name: "Contributo unificato",
            invoice_description: null,
            unit_price: null,
            requires_hearing_dates: false,
            sort_order: 20,
          },
        ]}
        onSaved={noop}
        onCancel={noop}
      />,
    );

    expect(html).toContain("Compensi");
    expect(html).toContain("Rimborsi spese");
    expect(html).toContain("DIFFIDA");
    expect(html).toContain("Contributo unificato");
  });

  it("renderizza la form Fattura con periodo, attività e riepilogo", () => {
    const html = renderWithQueryClient(<InvoiceForm />);

    expect(html).toContain("Dati fatturazione");
    expect(html).toContain("Attività");
    expect(html).toContain("Riepilogo");
    expect(html).toContain("Totale documento");
  });

  it("renderizza la tab Attività con stato vuoto e dialog di inserimento", () => {
    const html = renderWithQueryClient(
      <CaseActivitiesTab
        caseRow={{
          id: "case-1",
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-1",
          practice_number: 42,
          clients: { kind: "individual", first_name: "Ada", last_name: "Rossi" },
          counterparties: { kind: "company", business_name: "Beta S.p.A." },
        }}
      />,
    );

    expect(html).toContain("Attività");
    expect(html).toContain("Compensi");
    expect(html).toContain("Rimborsi spese");
  });
});
