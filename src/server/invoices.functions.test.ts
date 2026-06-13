import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data?: unknown; error?: Error | null };
type StoredCall = {
  table: string;
  action: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
};
type StoredRpcCall = {
  fn: string;
  args?: unknown;
};

const capturedServerFns = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const serverFn: Record<string, unknown> = {};
    return {
      middleware() {
        return this;
      },
      validator(validator: unknown) {
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

import { buildBillingWorkbook } from "@/lib/billing-xlsx";
import {
  createBillingInvoiceFn,
  generateBillingExportFn,
  generateInvoiceXmlFn,
  reserveInvoiceNumber,
  setInvoiceIssueStateFn,
  updateDraftBillingInvoiceFn,
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

  delete() {
    this.action = "delete";
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
  readonly rpcCalls: StoredRpcCall[] = [];
  readonly uploads: Array<{ bucket: string; path: string; body: Buffer; options: unknown }> = [];
  private readonly responses = new Map<string, QueryResult[]>();

  readonly storage = {
    from: (bucket: string) => ({
      upload: (path: string, body: Buffer, options: unknown) => {
        this.uploads.push({ bucket, path, body, options });
        return Promise.resolve({ error: null });
      },
      remove: () => Promise.resolve({ error: null }),
    }),
  };

  from(table: string) {
    return new FakeQueryBuilder(this, table);
  }

  rpc(fn: string, args?: unknown) {
    this.rpcCalls.push({ fn, args });
    return Promise.resolve(this.next(`rpc:${fn}`));
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
  cases: { practice_number: 42 },
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
      { data: { tax_regime: "ordinario", include_stamp_duty: false }, error: null },
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
    const activityUpdates = supabase.callsFor("case_activities", "update");
    expect(activityUpdates).toHaveLength(2);
    expect(activityUpdates[0].payload).toMatchObject({
      status: "to_invoice",
      invoice_id: "invoice-1",
      postponed_until: null,
    });
    expect(supabase.uploads).toHaveLength(2);
    expect(supabase.uploads[0].path).toContain("billing-exports/run-1/");
  });

  it("aggiorna una fattura in bozza senza riservare un nuovo numero", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("invoices:select:single", {
      data: {
        id: "invoice-1",
        public_code: "FT-00001",
        number: "12",
        year: 2026,
        status: "draft",
        billing_run_id: "run-1",
      },
      error: null,
    });
    supabase.queue("principals:select:single", {
      data: {
        id: "principal-1",
        business_name: "Banca Test",
        default_general_expenses_rate: 10,
      },
      error: null,
    });
    supabase.queue("profiles:select:single", {
      data: { tax_regime: "forfettario", include_stamp_duty: true },
      error: null,
    });
    supabase.queue("case_activities:select:many", {
      data: [
        { ...billingActivity, status: "invoiced", invoice_id: "invoice-1" },
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
    supabase.queue("billing_exports:select:many", {
      data: [{ storage_path: "user-1/billing-exports/run-1/old.xlsx" }],
      error: null,
    });
    supabase.queue("billing_run_items:select:many", {
      data: [
        { activity_id: "activity-fee", status: "included" },
        { activity_id: "activity-expense", status: "postponed" },
      ],
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
      {
        data: typeof billingInput & { invoiceId: string };
        context: { supabase: FakeSupabase; userId: string };
      },
      {
        invoiceId: string;
        invoiceRef: string;
        billingRunId: string;
        number: string;
        year: number;
      }
    >(updateDraftBillingInvoiceFn)({
      data: { ...billingInput, invoiceId: "invoice-1", status: "issued" },
      context: { supabase, userId: "user-1" },
    });

    expect(result).toMatchObject({
      invoiceId: "invoice-1",
      invoiceRef: "FT-00001",
      billingRunId: "run-1",
      number: "12",
      year: 2026,
    });
    expect(supabase.callsFor("profiles", "update")).toHaveLength(0);
    expect(supabase.callsFor("invoice_lines", "delete")).toHaveLength(1);
    expect(supabase.callsFor("billing_run_items", "delete")).toHaveLength(1);
    expect(supabase.callsFor("invoices", "update")[0].payload).toMatchObject({
      status: "issued",
      paid_at: null,
      principal_id: "principal-1",
      stamp_amount: 2,
    });
    expect(supabase.callsFor("case_activities", "update")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({
            status: "invoiced",
            invoice_id: "invoice-1",
            postponed_until: null,
          }),
        }),
      ]),
    );
    expect(supabase.callsFor("case_activities", "update").at(-1)?.payload).toMatchObject({
      postponed_count: 1,
    });
    expect(supabase.uploads).toHaveLength(2);
  });

  it("cambia emissione fattura tramite RPC atomica", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("rpc:set_invoice_issue_state", { data: "invoice-1", error: null });

    const result = await handlerOf<
      {
        data: { invoiceId: string; issued: boolean };
        context: { supabase: FakeSupabase; userId: string };
      },
      { invoiceId: string }
    >(setInvoiceIssueStateFn)({
      data: { invoiceId: "invoice-1", issued: true },
      context: { supabase, userId: "user-1" },
    });

    expect(result).toEqual({ invoiceId: "invoice-1" });
    expect(supabase.rpcCalls).toEqual([
      {
        fn: "set_invoice_issue_state",
        args: { p_invoice_id: "invoice-1", p_issued: true },
      },
    ]);
    expect(supabase.callsFor("invoices", "update")).toHaveLength(0);
    expect(supabase.callsFor("case_activities", "update")).toHaveLength(0);
  });

  it("rigenera un rendiconto Excel scaricabile dai dati della fattura", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("invoices:select:single", {
      data: { id: "invoice-1", billing_run_id: "run-1", principal_id: "principal-1" },
      error: null,
    });
    supabase.queue("billing_runs:select:single", {
      data: { period_start: "2026-05-01", period_end: "2026-05-31" },
      error: null,
    });
    supabase.queue("principals:select:single", {
      data: { business_name: "Banca Test" },
      error: null,
    });
    supabase.queue("invoice_lines:select:many", {
      data: [
        {
          case_activity_id: "activity-1",
          practice_number: 42,
          client_name: "Cliente snapshot",
          counterparty_name: "Controparte snapshot",
          activity_date: "2026-05-10",
          kind: "fee",
          description: "Descrizione storicizzata",
          quantity: 3,
          unit_price: 120,
          amount: 360,
        },
      ],
      error: null,
    });
    supabase.queue("case_activity_hearings:select:many", {
      data: [
        { activity_id: "activity-1", hearing_date: "2026-05-20", position: 2 },
        { activity_id: "activity-1", hearing_date: "2026-05-10", position: 1 },
      ],
      error: null,
    });

    const result = await handlerOf<
      {
        data: { invoiceId: string; kind: "fees" | "expenses" };
        context: { supabase: FakeSupabase; userId: string };
      },
      { bytesBase64: string; fileName: string; mimeType: string }
    >(generateBillingExportFn)({
      data: { invoiceId: "invoice-1", kind: "fees" },
      context: { supabase, userId: "user-1" },
    });

    expect(result).toEqual({
      bytesBase64: Buffer.from([1, 2, 3]).toString("base64"),
      fileName: "compensi-committente.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(buildBillingWorkbook).toHaveBeenLastCalledWith({
      kind: "fees",
      principalName: "Banca Test",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      rows: [
        {
          practiceNumber: 42,
          clientName: "Cliente snapshot",
          counterpartyName: "Controparte snapshot",
          activityDate: "2026-05-10",
          description: "Descrizione storicizzata",
          quantity: 3,
          unitPrice: 120,
          amount: 360,
          hearingDates: ["2026-05-10", "2026-05-20"],
        },
      ],
    });
    expect(supabase.callsFor("invoice_lines", "select")[0].filters).toEqual(
      expect.arrayContaining([
        ["invoice_id", "invoice-1"],
        ["kind", "fee"],
      ]),
    );
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
