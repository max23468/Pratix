import { describe, expect, it, vi } from "vitest";

type QueryResult = { data?: unknown; error?: Error | null };
type StoredCall = {
  table: string;
  action: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
};

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware() {
      return this;
    },
    validator() {
      return this;
    },
    handler(handler: unknown) {
      return { handler };
    },
  }),
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/insert-helpers", () => ({
  withTriggerGeneratedCode: <T>(payload: T) => payload,
}));

import { savePriceBookFn } from "./price-books.functions";

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

  delete() {
    this.action = "delete";
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
  private readonly responses = new Map<string, QueryResult[]>();

  from(table: string) {
    return new FakeQueryBuilder(this, table);
  }

  queue(key: string, ...responses: QueryResult[]) {
    this.responses.set(key, responses);
  }

  next(key: string): QueryResult {
    const queued = this.responses.get(key);
    if (queued?.length) return queued.shift()!;
    if (key.endsWith(":single")) return { data: { id: "price-book-1" }, error: null };
    return { data: [], error: null };
  }

  callsFor(table: string, action: string) {
    return this.calls.filter((call) => call.table === table && call.action === action);
  }
}

const handlerOf = <TArgs, TResult>(serverFn: unknown) =>
  (serverFn as { handler: (args: TArgs) => Promise<TResult> }).handler;

describe("server functions prezzi", () => {
  it("elimina soltanto gli id presenti nello snapshot iniziale del form", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("price_books:update:single", {
      data: { id: "price-book-1", public_code: "PRZ-00001" },
      error: null,
    });
    supabase.queue("case_activities:select:many", { data: [], error: null });

    await handlerOf<
      {
        data: {
          id: string;
          principal_id: string;
          year: number;
          status: "draft";
          fees_enabled: boolean;
          expense_reimbursements_enabled: boolean;
          valid_from: string;
          valid_to: null;
          notes: null;
          items: Array<{
            id: string;
            kind: "fee";
            code: string;
            name: string;
            invoice_description: null;
            unit_price: number;
            is_enabled: boolean;
            requires_hearing_dates: boolean;
            sort_order: number;
          }>;
          deleted_item_ids: string[];
        };
        context: { supabase: FakeSupabase; userId: string };
      },
      unknown
    >(savePriceBookFn)({
      data: {
        id: "price-book-1",
        principal_id: "principal-1",
        year: 2026,
        status: "draft",
        fees_enabled: true,
        expense_reimbursements_enabled: true,
        valid_from: "2026-01-01",
        valid_to: null,
        notes: null,
        items: [
          {
            id: "kept-item",
            kind: "fee",
            code: "COMP-1",
            name: "Compenso",
            invoice_description: null,
            unit_price: 100,
            is_enabled: true,
            requires_hearing_dates: false,
            sort_order: 10,
          },
        ],
        deleted_item_ids: ["removed-from-snapshot"],
      },
      context: { supabase, userId: "user-1" },
    });

    expect(supabase.callsFor("price_items", "select")).toHaveLength(0);
    expect(supabase.callsFor("price_items", "delete")[0].filters).toEqual([
      ["id", ["removed-from-snapshot"]],
      ["price_book_id", "price-book-1"],
      ["user_id", "user-1"],
    ]);
  });
});
