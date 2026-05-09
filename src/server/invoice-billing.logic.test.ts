import { describe, expect, it } from "vitest";

import {
  assertIncludedActivitiesBillable,
  billedPartyForInvoiceXml,
  buildBillingExportRows,
  buildBillingRunItemRows,
  buildBillingRunRow,
  buildInvoiceLineRows,
  buildInvoiceRow,
  firstIncludedClientId,
  invoiceLinesForTotals,
  partitionBillingActivities,
  postponedActivityUpdate,
  selectedActivityIds,
  selectionMap,
  validateCreateBillingInvoiceInput,
  type BillingActivity,
  type BillingTotals,
  type CreateBillingInvoiceInput,
} from "./invoice-billing.logic";

const baseInput = (
  overrides: Partial<CreateBillingInvoiceInput> = {},
): CreateBillingInvoiceInput => ({
  principalId: "principal-1",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  issueDate: "2026-06-01",
  dueDate: "2026-06-30",
  status: "draft",
  includeGeneralExpenses: true,
  generalExpensesRate: 10,
  cassaRate: 4,
  vatRate: 22,
  withholdingRate: 20,
  applyWithholding: true,
  paymentMethod: " Bonifico ",
  notes: " Note operative ",
  selections: [{ activityId: "activity-fee", status: "included", notes: "  ok  " }],
  ...overrides,
});

const baseTotals = (overrides: Partial<BillingTotals> = {}): BillingTotals => ({
  taxableFees: 1000,
  taxableExpenses: 0,
  art15Expenses: 118.5,
  generalExpensesAmount: 100,
  cassaBaseAmount: 1100,
  cassaAmount: 44,
  vatAmount: 251.68,
  withholdingAmount: 220,
  stampAmount: 2,
  totalAmount: 1516.18,
  netToPay: 1296.18,
  ...overrides,
});

const activity = (overrides: Partial<BillingActivity> = {}): BillingActivity => ({
  id: "activity-fee",
  case_id: "case-1",
  client_id: "client-1",
  activity_date: "2026-05-09",
  kind: "fee",
  status: "to_invoice",
  invoice_id: null,
  description: "Redazione diffida",
  quantity: "2",
  unit_price: "500",
  amount: "1000",
  postponed_count: null,
  cases: { practice_number: 42 },
  clients: { kind: "individual", first_name: "Ada", last_name: "Rossi", business_name: null },
  counterparties: {
    kind: "company",
    first_name: null,
    last_name: null,
    business_name: "Beta S.p.A.",
  },
  case_activity_hearings: [
    { hearing_date: "2026-05-20", position: 20 },
    { hearing_date: "2026-05-10", position: 10 },
  ],
  ...overrides,
});

describe("validateCreateBillingInvoiceInput", () => {
  it("accetta input valido e blocca errori di periodo, scadenza e selezioni", () => {
    expect(validateCreateBillingInvoiceInput(baseInput())).toMatchObject({
      principalId: "principal-1",
    });

    expect(() => validateCreateBillingInvoiceInput(baseInput({ principalId: "" }))).toThrow(
      "Seleziona un committente",
    );
    expect(() => validateCreateBillingInvoiceInput(baseInput({ periodEnd: "2026-04-30" }))).toThrow(
      "La data fine periodo",
    );
    expect(() => validateCreateBillingInvoiceInput(baseInput({ issueDate: "01/06/2026" }))).toThrow(
      "Data fattura non valida",
    );
    expect(() => validateCreateBillingInvoiceInput(baseInput({ dueDate: "30/06/2026" }))).toThrow(
      "Scadenza non valida",
    );
    expect(() => validateCreateBillingInvoiceInput(baseInput({ selections: [] }))).toThrow(
      "Seleziona almeno un'attività",
    );
    expect(() =>
      validateCreateBillingInvoiceInput(
        baseInput({ selections: [{ activityId: "activity-1", status: "postponed" }] }),
      ),
    ).toThrow("Includi almeno un'attività");
  });
});

describe("selezioni e attività fatturabili", () => {
  it("partiziona attività incluse e rinviate e blocca quelle già fatturate", () => {
    const selections = selectionMap([
      { activityId: "activity-fee", status: "included", notes: " fattura " },
      { activityId: "activity-expense", status: "postponed" },
    ]);
    const activities = [
      activity(),
      activity({ id: "activity-expense", kind: "expense_reimbursement" }),
      activity({ id: "activity-ignored" }),
    ];

    expect(selectedActivityIds(Array.from(selections.values()))).toEqual([
      "activity-fee",
      "activity-expense",
    ]);
    expect(partitionBillingActivities(activities, selections)).toMatchObject({
      included: [{ id: "activity-fee" }],
      postponed: [{ id: "activity-expense" }],
    });
    expect(firstIncludedClientId([activity()])).toBe("client-1");
    expect(() => firstIncludedClientId([activity({ client_id: null })])).toThrow(
      "cliente collegato",
    );
    expect(() =>
      assertIncludedActivitiesBillable([activity({ status: "invoiced", invoice_id: "invoice-1" })]),
    ).toThrow("già fatturate");
  });

  it("costruisce righe per totali, fattura, rendiconto e rinvio", () => {
    const fee = activity();
    const expense = activity({
      id: "activity-expense",
      kind: "expense_reimbursement",
      description: "Contributo unificato",
      quantity: 1,
      unit_price: 118.5,
      amount: 118.5,
      case_activity_hearings: [],
    });
    const input = baseInput();
    const totals = baseTotals();

    expect(invoiceLinesForTotals([fee, expense])).toEqual([
      { kind: "fee", quantity: 2, unit_price: 500 },
      { kind: "expense_art15", quantity: 1, unit_price: 118.5 },
    ]);
    expect(buildBillingRunRow({ input, userId: "user-1", totals })).toMatchObject({
      user_id: "user-1",
      compensation_total: 1000,
      notes: "Note operative",
    });
    expect(
      buildInvoiceRow({
        input,
        userId: "user-1",
        billingRunId: "run-1",
        firstIncluded: fee,
        number: "12",
        year: 2026,
        totals,
      }),
    ).toMatchObject({
      client_id: "client-1",
      payment_method: "Bonifico",
      net_to_pay: 1296.18,
    });
    expect(
      buildInvoiceLineRows({
        input,
        userId: "user-1",
        invoiceId: "invoice-1",
        included: [fee, expense],
        totals,
      }),
    ).toMatchObject([
      { position: 1, kind: "fee", client_name: "Ada Rossi", amount: 1000 },
      { position: 2, kind: "expense_art15", counterparty_name: "Beta S.p.A.", amount: 118.5 },
      { position: 3, case_activity_id: null, description: "Spese generali 10%", amount: 100 },
    ]);
    expect(buildBillingExportRows([fee], "fee")).toEqual([
      {
        practiceNumber: 42,
        clientName: "Ada Rossi",
        counterpartyName: "Beta S.p.A.",
        activityDate: "2026-05-09",
        description: "Redazione diffida",
        quantity: 2,
        unitPrice: 500,
        amount: 1000,
        hearingDates: ["2026-05-10", "2026-05-20"],
      },
    ]);
    expect(postponedActivityUpdate(activity({ postponed_count: "2" }), "2026-05-31")).toEqual({
      id: "activity-fee",
      postponed_until: "2026-06-01",
      postponed_count: 3,
    });
  });

  it("costruisce righe billing run items con note normalizzate", () => {
    const selections = selectionMap([
      { activityId: "activity-fee", status: "included", notes: " da fatturare " },
    ]);

    expect(
      buildBillingRunItemRows({
        activities: [activity(), activity({ id: "activity-other" })],
        billingRunId: "run-1",
        selections,
        userId: "user-1",
      }),
    ).toEqual([
      {
        user_id: "user-1",
        billing_run_id: "run-1",
        activity_id: "activity-fee",
        status: "included",
        notes: "da fatturare",
      },
      {
        user_id: "user-1",
        billing_run_id: "run-1",
        activity_id: "activity-other",
        status: "excluded",
        notes: null,
      },
    ]);
  });
});

describe("billedPartyForInvoiceXml", () => {
  it("preferisce il committente fattura e usa il cliente come fallback", () => {
    expect(
      billedPartyForInvoiceXml(
        {
          business_name: "Banca Test",
          tax_code: "01234567890",
          vat_number: "01234567890",
          sdi_code: "ABC1234",
          pec: "banca@example.test",
          address_street: "Via Roma 1",
          address_zip: "00100",
          address_city: "Roma",
          address_province: "RM",
          address_country: "IT",
        },
        { business_name: "Cliente ignorato" },
      ),
    ).toMatchObject({ kind: "company", business_name: "Banca Test" });
    expect(billedPartyForInvoiceXml(null, { business_name: "Cliente" })).toMatchObject({
      business_name: "Cliente",
    });
    expect(() => billedPartyForInvoiceXml(null, null)).toThrow("Committente della fattura");
  });
});
