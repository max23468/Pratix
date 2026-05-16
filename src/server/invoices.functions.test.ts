import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data?: unknown; error?: Error | null };
type StoredCall = {
  table: string;
  action: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
};

const capturedServerFns = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const serverFn: Record<string, unknown> = {};
    return {
      middleware() {
        return this;
      },
      inputValidator(validator: unknown) {
        serverFn.validator = validator;
        return this;
      },
      handler(handler: unknown) {
        serverFn.handler = handler;
        capturedServerFns.push(serverFn);
        return serverFn;
      },
    };
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: vi.fn(),
}));

vi.mock("@/lib/billing-xlsx", () => ({
  buildBillingWorkbook: vi.fn(
    ({ kind }: { kind: "fees" | "expenses" }) =>
      ({
        fileName: kind === "fees" ? "compensi-committente.xlsx" : "rimborsi-spese-committente.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: new Uint8Array([1, 2, 3]),
      }) as const,
  ),
}));

import {
  createBillingInvoiceFn,
  generateInvoiceXmlFn,
  reserveInvoiceNumber,
} from "./invoices.functions";

class FakeQueryBuilder {
  private action = "select";
  private payload: unknown;
  private filters: Array<[string, unknown]> = [];

  constructor(
    private readonly supabase: FakeSupabase,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  update(payload: unknown) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  insert(payload: unknown) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  in(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order() {
    return this;
  }

  single() {
    return this.resolve("single");
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.resolve("many").then(onfulfilled, onrejected);
  }

  private resolve(mode: "single" | "many") {
    this.supabase.calls.push({
      table: this.table,
      action: this.action,
      payload: this.payload,
      filters: this.filters,
    });
    return Promise.resolve(this.supabase.next(`${this.table}:${this.action}:${mode}`));
  }
}

class FakeSupabase {
  readonly calls: StoredCall[] = [];
  readonly uploads: Array<{ bucket: string; path: string; body: Buffer; options: unknown }> = [];
  private readonly responses = new Map<string, QueryResult[]>();

  readonly storage = {
    from: (bucket: string) => ({
      upload: (path: string, body: Buffer, options: unknown) => {
        this.uploads.push({ bucket, path, body, options });
        return Promise.resolve({ error: null });
      },
    }),
  };

  from(table: string) {
    return new FakeQueryBuilder(this, table);
  }

  queue(key: string, ...responses: QueryResult[]) {
    this.responses.set(key, responses);
  }

  next(key: string): QueryResult {
    const queued = this.responses.get(key);
    if (queued?.length) return queued.shift()!;
    if (key.endsWith(":single")) return { data: { id: `${key.split(":")[0]}-id` }, error: null };
    return { data: null, error: null };
  }

  callsFor(table: string, action: string) {
    return this.calls.filter((call) => call.table === table && call.action === action);
  }
}

const handlerOf = <TArgs, TResult>(serverFn: unknown) =>
  (serverFn as { handler: (args: TArgs) => Promise<TResult> }).handler;

const billingInput = {
  principalId: "principal-1",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  issueDate: "2026-06-01",
  dueDate: "2026-06-30",
  status: "draft" as const,
  includeGeneralExpenses: true,
  generalExpensesRate: 10,
  cassaRate: 4,
  vatRate: 22,
  withholdingRate: 20,
  applyWithholding: true,
  paymentMethod: "Bonifico bancario",
  notes: "Rendiconto maggio",
  selections: [
    { activityId: "activity-fee", status: "included" as const },
    { activityId: "activity-expense", status: "postponed" as const },
  ],
};

const billingActivity = {
  id: "activity-fee",
  case_id: "case-1",
  principal_id: "principal-1",
  client_id: "client-1",
  counterparty_id: "counterparty-1",
  activity_date: "2026-05-10",
  kind: "fee",
  status: "to_invoice",
  invoice_id: null,
  description: "Redazione diffida",
  quantity: 2,
  unit_price: 500,
  amount: 1000,
  postponed_count: null,
  cases: { practice_number: 42, title: "Pratica 42" },
  clients: { kind: "individual", first_name: "Ada", last_name: "Rossi", business_name: null },
  counterparties: {
    kind: "company",
    first_name: null,
    last_name: null,
    business_name: "Beta S.p.A.",
  },
  case_activity_hearings: [{ hearing_date: "2026-05-20", position: 1 }],
};

beforeEach(() => {
  capturedServerFns.length = 0;
});

describe("server functions fatture", () => {
  it("riserva il prossimo numero fattura e aggiorna il progressivo", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("profiles:select:single", {
      data: { invoice_year: 2026, invoice_next_number: 7, invoice_number_prefix: "F-" },
      error: null,
    });

    const result = await handlerOf<
      { context: { supabase: FakeSupabase; userId: string } },
      { number: string; year: number }
    >(reserveInvoiceNumber)({
      context: { supabase, userId: "user-1" },
    });

    expect(result).toEqual({ number: "F-7", year: 2026 });
    expect(supabase.callsFor("profiles", "update")[0].payload).toEqual({
      invoice_year: 2026,
      invoice_next_number: 8,
    });
  });

  it("crea fattura da attività incluse, rinvia le escluse e salva i rendiconti", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("principals:select:single", {
      data: {
        id: "principal-1",
        business_name: "Banca Test",
        default_general_expenses_rate: 10,
      },
      error: null,
    });
    supabase.queue(
      "profiles:select:single",
      { data: { tax_regime: "ordinario" }, error: null },
      {
        data: { invoice_year: 2026, invoice_next_number: 12, invoice_number_prefix: "" },
        error: null,
      },
    );
    supabase.queue("case_activities:select:many", {
      data: [
        billingActivity,
        {
          ...billingActivity,
          id: "activity-expense",
          kind: "expense_reimbursement",
          amount: 118.5,
          quantity: 1,
          unit_price: 118.5,
          postponed_count: 1,
        },
      ],
      error: null,
    });
    supabase.queue("billing_runs:insert:single", { data: { id: "run-1" }, error: null });
    supabase.queue("invoices:insert:single", {
      data: { id: "invoice-1", public_code: "FT-00001" },
      error: null,
    });
    supabase.queue(
      "billing_exports:insert:single",
      { data: { id: "export-fees", file_name: "compensi-committente.xlsx" }, error: null },
      {
        data: { id: "export-expenses", file_name: "rimborsi-spese-committente.xlsx" },
        error: null,
      },
    );

    const result = await handlerOf<
      { data: typeof billingInput; context: { supabase: FakeSupabase; userId: string } },
      {
        invoiceId: string;
        invoiceRef: string;
        billingRunId: string;
        number: string;
        exports: unknown[];
      }
    >(createBillingInvoiceFn)({
      data: billingInput,
      context: { supabase, userId: "user-1" },
    });

    expect(result).toMatchObject({
      invoiceId: "invoice-1",
      invoiceRef: "FT-00001",
      billingRunId: "run-1",
      number: "12",
      exports: [
        { id: "export-fees", file_name: "compensi-committente.xlsx" },
        { id: "export-expenses", file_name: "rimborsi-spese-committente.xlsx" },
      ],
    });
    expect(supabase.callsFor("invoice_lines", "insert")[0].payload).toHaveLength(2);
    expect(supabase.callsFor("case_activities", "update")).toHaveLength(2);
    expect(supabase.uploads).toHaveLength(2);
    expect(supabase.uploads[0].path).toContain("billing-exports/run-1/");
  });

  it("genera XML usando il committente come soggetto fatturato", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("invoices:select:single", {
      data: {
        id: "invoice-1",
        number: "12",
        year: 2026,
        issue_date: "2026-06-01",
        due_date: "2026-06-30",
        payment_method: "Bonifico bancario",
        principal_id: "principal-1",
        client_id: "client-1",
        cassa_rate: 4,
        vat_rate: 22,
        withholding_rate: 20,
        apply_withholding: true,
        taxable_fees: 1000,
        taxable_expenses: 0,
        art15_expenses: 0,
        general_expenses_amount: 100,
        cassa_base_amount: 1100,
        cassa_amount: 44,
        vat_amount: 251.68,
        withholding_amount: 220,
        stamp_amount: 2,
        total_amount: 1177.68,
      },
      error: null,
    });
    supabase.queue("profiles:select:single", {
      data: {
        business_name: "Avv. Test",
        full_name: null,
        vat_number: "12345678901",
        tax_code: "TSTTST80A01H501A",
        address_street: "Via Roma 1",
        address_zip: "00100",
        address_city: "Roma",
        address_province: "RM",
        address_country: "IT",
        tax_regime: "ordinario",
      },
      error: null,
    });
    supabase.queue("invoice_lines:select:many", {
      data: [
        {
          kind: "fee",
          description: "Redazione diffida",
          quantity: 1,
          unit_price: 1000,
          amount: 1000,
        },
      ],
      error: null,
    });
    supabase.queue("principals:select:single", {
      data: {
        kind: "company",
        business_name: "Banca Test",
        vat_number: "01234567890",
        tax_code: "01234567890",
        sdi_code: "ABC1234",
        pec: null,
        address_street: "Via Milano 2",
        address_zip: "20100",
        address_city: "Milano",
        address_province: "MI",
        address_country: "IT",
      },
      error: null,
    });
    supabase.queue("clients:select:single", {
      data: { kind: "individual", first_name: "Ada", last_name: "Rossi" },
      error: null,
    });

    const result = await handlerOf<
      { data: { invoiceId: string }; context: { supabase: FakeSupabase; userId: string } },
      { xml: string; filename: string }
    >(generateInvoiceXmlFn)({
      data: { invoiceId: "invoice-1" },
      context: { supabase, userId: "user-1" },
    });

    expect(result.filename).toBe("IT12345678901_202612.xml");
    expect(result.xml).toContain("<Denominazione>Banca Test</Denominazione>");
    expect(result.xml).toContain("<CodiceDestinatario>ABC1234</CodiceDestinatario>");
  });
});
