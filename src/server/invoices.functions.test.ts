import { describe, expect, it, vi } from "vitest";

type QueryResult = { data?: unknown; error?: Error | null };
type StoredCall = {
  table: string;
  action: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
};

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
        return serverFn;
      },
    };
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: vi.fn(),
}));

vi.mock("@/lib/billing-xlsx", () => ({
  buildBillingWorkbook: vi.fn(({ kind }: { kind: "fees" | "expenses" }) => ({
    fileName: kind === "fees" ? "compensi.xlsx" : "rimborsi.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes: new Uint8Array([1, 2, 3]),
  })),
}));

import { buildBillingWorkbook } from "@/lib/billing-xlsx";
import { createBillingInvoiceFn, updateDraftBillingInvoiceFn } from "./invoices-create.functions";
import { generateBillingExportFn, generateInvoiceXmlFn } from "./invoices-export.functions";
import { setInvoiceIssueStateFn } from "./invoices-issue.functions";

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

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  in(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order() {
    return this;
  }

  single() {
    return this.resolve("single");
  }

  maybeSingle() {
    return this.resolve("maybeSingle");
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.resolve("many").then(onfulfilled, onrejected);
  }

  private resolve(mode: "single" | "maybeSingle" | "many") {
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
  readonly rpcCalls: Array<{ fn: string; args?: unknown }> = [];
  readonly uploads: Array<{ bucket: string; path: string; options: unknown }> = [];
  uploadErrors: Array<Error | null> = [];
  private readonly responses = new Map<string, QueryResult[]>();

  readonly storage = {
    from: (bucket: string) => ({
      upload: (path: string, _body: Buffer, options: unknown) => {
        this.uploads.push({ bucket, path, options });
        return Promise.resolve({ error: this.uploadErrors.shift() ?? null });
      },
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
    return { data: null, error: null };
  }

  callsFor(table: string, action: string) {
    return this.calls.filter((call) => call.table === table && call.action === action);
  }
}

const handlerOf = <TArgs, TResult>(serverFn: unknown) =>
  (serverFn as { handler: (args: TArgs) => Promise<TResult> }).handler;

const requestId = "11111111-1111-4111-8111-111111111111";
const billingInput = {
  requestId,
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
  postponed_count: 0,
  postponed_until: null,
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

function queueInvoiceSave(
  supabase: FakeSupabase,
  activityOverrides: Partial<Omit<typeof billingActivity, "invoice_id">> & {
    invoice_id?: string | null;
  } = {},
) {
  supabase.queue("principals:select:single", {
    data: { id: "principal-1", business_name: "Banca Test" },
    error: null,
  });
  supabase.queue("profiles:select:single", {
    data: { tax_regime: "ordinario", include_stamp_duty: false },
    error: null,
  });
  supabase.queue("case_activities:select:many", {
    data: [
      { ...billingActivity, ...activityOverrides },
      {
        ...billingActivity,
        ...activityOverrides,
        id: "activity-expense",
        kind: "expense_reimbursement",
      },
    ],
    error: null,
  });
  supabase.queue("rpc:save_billing_invoice", {
    data: {
      invoiceId: "invoice-1",
      invoiceRef: "FT-00001",
      billingRunId: "run-1",
      number: "12",
      year: 2026,
      exports: [
        {
          id: "export-fees",
          kind: "fees",
          file_name: "compensi.xlsx",
          storage_path: "user-1/billing-exports/run-1/compensi.xlsx",
          storage_status: "pending",
        },
        {
          id: "export-expenses",
          kind: "expenses",
          file_name: "rimborsi.xlsx",
          storage_path: "user-1/billing-exports/run-1/rimborsi.xlsx",
          storage_status: "pending",
        },
      ],
    },
    error: null,
  });
}

const savedExports = [
  {
    id: "export-fees",
    kind: "fees",
    file_name: "compensi.xlsx",
    storage_path: "user-1/billing-exports/run-1/compensi.xlsx",
    storage_status: "pending",
  },
  {
    id: "export-expenses",
    kind: "expenses",
    file_name: "rimborsi.xlsx",
    storage_path: "user-1/billing-exports/run-1/rimborsi.xlsx",
    storage_status: "pending",
  },
];

function queueStoredInvoiceRecovery(
  supabase: FakeSupabase,
  { create = false, status = "draft" }: { create?: boolean; status?: "draft" | "issued" } = {},
) {
  if (create) {
    supabase.queue("billing_runs:select:maybeSingle", {
      data: { id: "run-1", invoice_id: "invoice-1" },
      error: null,
    });
  }
  supabase.queue(
    "invoices:select:single",
    ...Array.from({ length: 3 }, () => ({
      data: {
        id: "invoice-1",
        public_code: "FT-00001",
        billing_run_id: "run-1",
        principal_id: "principal-1",
        number: "12",
        year: 2026,
        status,
      },
      error: null,
    })),
  );
  supabase.queue("billing_exports:select:many", { data: savedExports, error: null });
  supabase.queue(
    "billing_runs:select:single",
    ...Array.from({ length: 2 }, () => ({
      data: { period_start: "2026-05-01", period_end: "2026-05-31" },
      error: null,
    })),
  );
  supabase.queue(
    "principals:select:single",
    ...Array.from({ length: 2 }, () => ({
      data: { business_name: "Committente persistito" },
      error: null,
    })),
  );
  supabase.queue(
    "billing_exports:select:maybeSingle",
    ...savedExports.map((item) => ({ data: item, error: null })),
  );
  supabase.queue(
    "invoice_lines:select:many",
    {
      data: [
        {
          ...billingActivity,
          case_activity_id: billingActivity.id,
          practice_number: 42,
          client_name: "Cliente persistito",
          counterparty_name: "Controparte persistita",
        },
      ],
      error: null,
    },
    {
      data: [
        {
          ...billingActivity,
          case_activity_id: "activity-expense",
          kind: "expense_art15",
          practice_number: 42,
          client_name: "Cliente persistito",
          counterparty_name: "Controparte persistita",
        },
      ],
      error: null,
    },
  );
  supabase.queue("case_activity_hearings:select:many", {
    data: [{ activity_id: "activity-fee", hearing_date: "2026-05-20", position: 1 }],
    error: null,
  });
}

describe("server functions fatture", () => {
  it("salva fattura e metadati con una sola RPC, poi completa Storage in modo idempotente", async () => {
    const supabase = new FakeSupabase();
    queueInvoiceSave(supabase);

    const result = await handlerOf<
      { data: typeof billingInput; context: { supabase: FakeSupabase; userId: string } },
      { invoiceId: string; exports: Array<{ storage_status: string }> }
    >(createBillingInvoiceFn)({
      data: billingInput,
      context: { supabase, userId: "user-1" },
    });

    expect(result.invoiceId).toBe("invoice-1");
    expect(result.exports.every((item) => item.storage_status === "ready")).toBe(true);
    expect(supabase.rpcCalls).toHaveLength(1);
    expect(supabase.rpcCalls[0]).toMatchObject({
      fn: "save_billing_invoice",
      args: { p_request_id: requestId, p_invoice_id: null },
    });
    expect(
      supabase.calls.some((call) => call.action === "insert" || call.action === "delete"),
    ).toBe(false);
    expect(supabase.uploads).toHaveLength(2);
    expect(supabase.uploads.every((upload) => upload.options)).toBe(true);
    expect(supabase.uploads[0].options).toMatchObject({ upsert: true });
    expect(supabase.callsFor("billing_exports", "update")).toHaveLength(2);
  });

  it("mantiene il risultato atomico recuperabile quando un upload fallisce e consente il retry", async () => {
    const supabase = new FakeSupabase();
    queueInvoiceSave(supabase);
    supabase.uploadErrors = [new Error("Storage non disponibile"), null];

    await expect(
      handlerOf<
        { data: typeof billingInput; context: { supabase: FakeSupabase; userId: string } },
        unknown
      >(createBillingInvoiceFn)({
        data: billingInput,
        context: { supabase, userId: "user-1" },
      }),
    ).rejects.toThrow("Fattura salvata");

    expect(supabase.rpcCalls).toHaveLength(1);
    expect(supabase.uploads).toHaveLength(2);
    expect(supabase.calls.some((call) => call.action === "delete")).toBe(false);

    queueStoredInvoiceRecovery(supabase, { create: true });
    await expect(
      handlerOf<
        { data: typeof billingInput; context: { supabase: FakeSupabase; userId: string } },
        unknown
      >(createBillingInvoiceFn)({
        data: {
          ...billingInput,
          principalId: "principal-modificato",
          selections: [],
        },
        context: { supabase, userId: "user-1" },
      }),
    ).resolves.toMatchObject({ invoiceId: "invoice-1" });
    expect(supabase.rpcCalls).toHaveLength(1);
    expect(supabase.uploads).toHaveLength(4);
    expect(buildBillingWorkbook).toHaveBeenLastCalledWith(
      expect.objectContaining({ principalName: "Committente persistito" }),
    );
  });

  it("aggiorna una bozza attraverso la stessa transazione senza progressivi applicativi", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("invoices:select:single", {
      data: {
        id: "invoice-1",
        public_code: "FT-00001",
        billing_run_id: "run-1",
        number: "12",
        year: 2026,
        status: "draft",
      },
      error: null,
    });
    supabase.queue("billing_exports:select:many", {
      data: savedExports.map((item) => ({ ...item, storage_status: "ready" })),
      error: null,
    });
    queueInvoiceSave(supabase);

    await handlerOf<
      {
        data: typeof billingInput & { invoiceId: string };
        context: { supabase: FakeSupabase; userId: string };
      },
      unknown
    >(updateDraftBillingInvoiceFn)({
      data: { ...billingInput, invoiceId: "invoice-1" },
      context: { supabase, userId: "user-1" },
    });

    expect(supabase.rpcCalls[0]).toMatchObject({
      fn: "save_billing_invoice",
      args: { p_request_id: requestId, p_invoice_id: "invoice-1" },
    });
    expect(supabase.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("recupera gli export di un aggiornamento già emesso senza rieseguire la RPC", async () => {
    const supabase = new FakeSupabase();
    queueStoredInvoiceRecovery(supabase, { status: "issued" });

    await expect(
      handlerOf<
        {
          data: typeof billingInput & { invoiceId: string };
          context: { supabase: FakeSupabase; userId: string };
        },
        unknown
      >(updateDraftBillingInvoiceFn)({
        data: {
          ...billingInput,
          invoiceId: "invoice-1",
          principalId: "principal-modificato",
          selections: [],
        },
        context: { supabase, userId: "user-1" },
      }),
    ).resolves.toMatchObject({ invoiceId: "invoice-1" });

    expect(supabase.rpcCalls).toHaveLength(0);
    expect(supabase.uploads).toHaveLength(2);
    expect(buildBillingWorkbook).toHaveBeenLastCalledWith(
      expect.objectContaining({ principalName: "Committente persistito" }),
    );
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
      { fn: "set_invoice_issue_state", args: { p_invoice_id: "invoice-1", p_issued: true } },
    ]);
  });

  it("rigenera un rendiconto dai dati della fattura e recupera il file Storage", async () => {
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
    supabase.queue("billing_exports:select:maybeSingle", {
      data: { id: "export-fees", storage_path: "user-1/billing-exports/run-1/compensi.xlsx" },
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
      data: [{ activity_id: "activity-1", hearing_date: "2026-05-20", position: 1 }],
      error: null,
    });

    const result = await handlerOf<
      {
        data: { invoiceId: string; kind: "fees" };
        context: { supabase: FakeSupabase; userId: string };
      },
      { bytesBase64: string }
    >(generateBillingExportFn)({
      data: { invoiceId: "invoice-1", kind: "fees" },
      context: { supabase, userId: "user-1" },
    });

    expect(result.bytesBase64).toBe(Buffer.from([1, 2, 3]).toString("base64"));
    expect(buildBillingWorkbook).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "fees", principalName: "Banca Test" }),
    );
    expect(supabase.uploads[0]).toMatchObject({
      path: "user-1/billing-exports/run-1/compensi.xlsx",
      options: { upsert: true },
    });
    expect(supabase.callsFor("billing_exports", "update")).toHaveLength(1);
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
        address_street: "Via Milano 2",
        address_zip: "20100",
        address_city: "Milano",
        address_province: "MI",
        address_country: "IT",
      },
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
