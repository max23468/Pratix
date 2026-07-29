import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_DATA_DELETE_TABLE_ORDER } from "./account-deletion.logic";

type QueryResult = { data?: unknown; error?: Error | null };
type StoredCall = {
  table: string;
  action: string;
  filters: Array<[string, unknown]>;
};
type StorageListCall = { prefix: string; options: { limit: number; offset: number } };

const { adminState } = vi.hoisted(() => ({
  adminState: { current: null as FakeSupabaseAdmin | null },
}));

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

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return adminState.current;
  },
}));

import { deleteAccountFn } from "./account.functions";

class FakeQueryBuilder {
  private action = "select";
  private filters: Array<[string, unknown]> = [];

  constructor(
    private readonly supabase: FakeSupabaseAdmin,
    private readonly table: string,
  ) {}

  select() {
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

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    this.supabase.calls.push({
      table: this.table,
      action: this.action,
      filters: [...this.filters],
    });
    return Promise.resolve(this.supabase.next(`${this.table}:${this.action}`)).then(
      onfulfilled,
      onrejected,
    );
  }
}

class FakeSupabaseAdmin {
  readonly calls: StoredCall[] = [];
  readonly removeCalls: string[][] = [];
  readonly listCalls: StorageListCall[] = [];
  private readonly responses = new Map<string, QueryResult[]>();
  private readonly storageLists = new Map<
    string,
    Array<{ data?: unknown; error?: Error | null }>
  >();

  readonly auth = {
    admin: {
      deleteUser: vi.fn(async () => ({ error: null })),
    },
  };

  readonly storage = {
    from: (_bucket: string) => ({
      list: (prefix: string, options: { limit: number; offset: number }) => {
        this.listCalls.push({ prefix, options });
        const queued = this.storageLists.get(prefix) ?? [];
        const next = queued.shift() ?? { data: [], error: null };
        this.storageLists.set(prefix, queued);
        return Promise.resolve(next);
      },
      remove: (paths: string[]) => {
        this.removeCalls.push(paths);
        const next = this.next("storage:remove");
        return Promise.resolve({ error: (next.error as Error | null) ?? null });
      },
    }),
  };

  from(table: string) {
    return new FakeQueryBuilder(this, table);
  }

  queue(key: string, ...responses: QueryResult[]) {
    this.responses.set(key, responses);
  }

  queueStorageList(prefix: string, ...responses: Array<{ data?: unknown; error?: Error | null }>) {
    this.storageLists.set(prefix, responses);
  }

  next(key: string): QueryResult {
    const queued = this.responses.get(key);
    if (queued?.length) return queued.shift()!;
    return { data: [], error: null };
  }

  callsFor(table: string, action: string) {
    return this.calls.filter((call) => call.table === table && call.action === action);
  }
}

const handlerOf = <TArgs, TResult>(serverFn: unknown) =>
  (serverFn as { handler: (args: TArgs) => Promise<TResult> }).handler;

describe("deleteAccountFn", () => {
  beforeEach(() => {
    adminState.current = new FakeSupabaseAdmin();
  });

  it("cancella dati applicativi, utente auth e oggetti storage noti o ricorsivi", async () => {
    const supabaseAdmin = adminState.current!;
    supabaseAdmin.queue("activity_attachments:select", {
      data: [
        { storage_path: "user-1/attachments/a.pdf" },
        { storage_path: "user-1/attachments/a.pdf" },
      ],
      error: null,
    });
    supabaseAdmin.queue("billing_exports:select", {
      data: [{ storage_path: "user-1/exports/report.zip" }],
      error: null,
    });
    supabaseAdmin.queue("imports:select", {
      data: [{ source_storage_path: "user-1/imports/source.xlsx" }],
      error: null,
    });
    supabaseAdmin.queueStorageList("user-1", {
      data: [
        { name: "attachments", id: null, metadata: null },
        { name: "manual.pdf", id: "file-1", metadata: {} },
      ],
      error: null,
    });
    supabaseAdmin.queueStorageList("user-1/attachments", {
      data: [{ name: "nested.pdf", id: "file-2", metadata: {} }],
      error: null,
    });

    const result = await handlerOf<
      { context: { userId: string } },
      { deleted: boolean; removedStorageObjects: number; storageCleanupCompleted: boolean }
    >(deleteAccountFn)({
      context: { userId: "user-1" },
    });

    expect(result).toEqual({
      deleted: true,
      removedStorageObjects: 5,
      storageCleanupCompleted: true,
    });
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
    expect(supabaseAdmin.listCalls).toEqual([
      { prefix: "user-1", options: { limit: 1000, offset: 0 } },
      { prefix: "user-1/attachments", options: { limit: 1000, offset: 0 } },
    ]);
    expect(supabaseAdmin.removeCalls).toEqual([
      [
        "user-1/attachments/a.pdf",
        "user-1/attachments/nested.pdf",
        "user-1/exports/report.zip",
        "user-1/imports/source.xlsx",
        "user-1/manual.pdf",
      ],
    ]);
    expect(supabaseAdmin.callsFor("profiles", "delete")[0].filters).toEqual([["id", "user-1"]]);
    expect(supabaseAdmin.callsFor("principals", "delete")[0].filters).toEqual([
      ["user_id", "user-1"],
    ]);
    expect(supabaseAdmin.calls.filter((call) => call.action === "delete")).toHaveLength(
      ACCOUNT_DATA_DELETE_TABLE_ORDER.length,
    );
  });

  it("se il cleanup storage fallisce restituisce stato incompleto ma elimina comunque l'account", async () => {
    const supabaseAdmin = adminState.current!;
    supabaseAdmin.queue("activity_attachments:select", {
      data: [{ storage_path: "user-1/attachments/a.pdf" }],
      error: null,
    });
    supabaseAdmin.queue("billing_exports:select", { data: [], error: null });
    supabaseAdmin.queue("imports:select", { data: [], error: null });
    supabaseAdmin.queueStorageList("user-1", { data: [], error: null });
    supabaseAdmin.queue("storage:remove", { error: new Error("storage down") });

    const result = await handlerOf<
      { context: { userId: string } },
      { deleted: boolean; removedStorageObjects: number; storageCleanupCompleted: boolean }
    >(deleteAccountFn)({
      context: { userId: "user-1" },
    });

    expect(result).toEqual({
      deleted: true,
      removedStorageObjects: 0,
      storageCleanupCompleted: false,
    });
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
    expect(supabaseAdmin.removeCalls).toEqual([["user-1/attachments/a.pdf"]]);
  });

  it("pagina tutti gli oggetti e scarta path noti fuori dal prefix utente", async () => {
    const supabaseAdmin = adminState.current!;
    supabaseAdmin.queue("activity_attachments:select", {
      data: [{ storage_path: "user-2/attachments/victim.pdf" }],
      error: null,
    });
    supabaseAdmin.queue("billing_exports:select", { data: [], error: null });
    supabaseAdmin.queue("imports:select", { data: [], error: null });
    supabaseAdmin.queueStorageList(
      "user-1",
      {
        data: Array.from({ length: 1000 }, (_, index) => ({
          name: `file-${index}.pdf`,
          id: `file-${index}`,
          metadata: {},
        })),
        error: null,
      },
      {
        data: [{ name: "file-1000.pdf", id: "file-1000", metadata: {} }],
        error: null,
      },
    );

    const result = await handlerOf<
      { context: { userId: string } },
      { removedStorageObjects: number; storageCleanupCompleted: boolean }
    >(deleteAccountFn)({
      context: { userId: "user-1" },
    });

    expect(result).toMatchObject({ removedStorageObjects: 1001, storageCleanupCompleted: true });
    expect(supabaseAdmin.listCalls).toEqual([
      { prefix: "user-1", options: { limit: 1000, offset: 0 } },
      { prefix: "user-1", options: { limit: 1000, offset: 1000 } },
    ]);
    expect(supabaseAdmin.removeCalls.flat()).not.toContain("user-2/attachments/victim.pdf");
  });
});
