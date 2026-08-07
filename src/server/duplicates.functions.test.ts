import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data?: unknown; error?: Error | null };
type StoredCall = {
  table: string;
  action: string;
  payload?: unknown;
  options?: unknown;
  limit?: number;
  filters: Array<[string, unknown]>;
};

const capturedServerFns = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const duplicateLogicMock = vi.hoisted(() => ({
  reviewInsertFromCandidate: vi.fn(),
  scanDuplicateCandidates: vi.fn(),
  scanDuplicateDraft: vi.fn(),
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
        capturedServerFns.push(serverFn);
        return serverFn;
      },
    };
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: vi.fn(),
}));

vi.mock("@/server/duplicates.logic", () => duplicateLogicMock);

import {
  findDuplicateCandidatesFn,
  getDuplicateSummaryFn,
  resolveDuplicateCandidateFn,
  scanDuplicateCandidatesFn,
} from "./duplicates.functions";

class FakeQueryBuilder {
  private action = "select";
  private payload: unknown;
  private options: unknown;
  private rowLimit: number | undefined;
  private filters: Array<[string, unknown]> = [];

  constructor(
    private readonly supabase: FakeSupabase,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  insert(payload: unknown) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown, options?: unknown) {
    this.action = "upsert";
    this.payload = payload;
    this.options = options;
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

  is(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order() {
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
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

  private resolve(mode: "single" | "many" | "maybeSingle") {
    this.supabase.calls.push({
      table: this.table,
      action: this.action,
      payload: this.payload,
      options: this.options,
      limit: this.rowLimit,
      filters: [...this.filters],
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

  rpc(name: string, payload: unknown) {
    this.calls.push({ table: name, action: "rpc", payload, filters: [] });
    return Promise.resolve(this.next(`${name}:rpc`));
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

const validatorOf = <TInput>(serverFn: unknown) =>
  (serverFn as { validator: (input: TInput) => TInput }).validator;

function queueScanData(
  supabase: FakeSupabase,
  overrides?: Partial<{
    principals: unknown[];
    clients: unknown[];
    principalClients: unknown[];
    counterparties: unknown[];
    counterpartySubjects: unknown[];
    cases: unknown[];
    activities: unknown[];
    reviews: unknown[];
  }>,
) {
  supabase.queue("principals:select:many", {
    data: overrides?.principals ?? [],
    error: null,
  });
  supabase.queue("clients:select:many", {
    data: overrides?.clients ?? [],
    error: null,
  });
  supabase.queue("principal_clients:select:many", {
    data: overrides?.principalClients ?? [],
    error: null,
  });
  supabase.queue("counterparties:select:many", {
    data: overrides?.counterparties ?? [],
    error: null,
  });
  supabase.queue("counterparty_subjects:select:many", {
    data: overrides?.counterpartySubjects ?? [],
    error: null,
  });
  supabase.queue("cases:select:many", {
    data: overrides?.cases ?? [],
    error: null,
  });
  supabase.queue("case_activities:select:many", {
    data: overrides?.activities ?? [],
    error: null,
  });
  supabase.queue("duplicate_reviews:select:many", {
    data: overrides?.reviews ?? [],
    error: null,
  });
}

beforeEach(() => {
  capturedServerFns.length = 0;
  duplicateLogicMock.reviewInsertFromCandidate.mockReset();
  duplicateLogicMock.scanDuplicateCandidates.mockReset();
  duplicateLogicMock.scanDuplicateDraft.mockReset();
  vi.useRealTimers();
});

describe("duplicates server functions", () => {
  it("carica il dataset, persiste i sospetti aperti nuovi e arricchisce reviewId/detectedAt", async () => {
    const supabase = new FakeSupabase();
    queueScanData(supabase, {
      principals: [{ id: "principal-1", public_code: "COM-1", business_name: "Alfa" }],
      clients: [
        {
          id: "client-1",
          public_code: "CLI-1",
          kind: "company",
          business_name: "Cliente Uno",
          notes: null,
        },
      ],
      principalClients: [
        { client_id: "client-1", principals: { business_name: "Alfa" } },
        { client_id: "client-1", principals: { business_name: "Beta" } },
      ],
      counterparties: [
        {
          id: "counterparty-1",
          public_code: "CTP-1",
          kind: "individual",
          first_name: "Lia",
          last_name: "Verdi",
          notes: null,
        },
      ],
      counterpartySubjects: [
        {
          id: "subject-1",
          counterparty_id: "counterparty-1",
          kind: "company",
          business_name: "Studio Delta",
          first_name: null,
          last_name: null,
          notes: null,
          position: 0,
          counterparties: {
            public_code: "CTP-1",
            kind: "individual",
            first_name: "Lia",
            last_name: "Verdi",
            business_name: null,
          },
        },
      ],
      cases: [
        {
          id: "case-1",
          public_code: "PRA-1",
          practice_number: 77,
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-1",
          authority: "Tribunale",
          rg_number: "123/2026",
          opened_at: "2026-01-10",
          status: "active",
          principals: { business_name: "Alfa" },
          clients: {
            kind: "company",
            first_name: null,
            last_name: null,
            business_name: "Cliente Uno",
          },
          counterparties: {
            kind: "individual",
            first_name: "Lia",
            last_name: "Verdi",
            business_name: null,
          },
        },
      ],
      activities: [
        {
          id: "activity-1",
          case_id: "case-1",
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-1",
          price_item_id: "price-1",
          invoice_id: null,
          activity_date: "2026-01-15",
          kind: "fee",
          status: "to_invoice",
          snapshot_price_code: "P1",
          snapshot_price_name: "Diffida",
          description: "Diffida iniziale",
          quantity: 1,
          unit_price: 200,
          amount: 200,
          cases: { public_code: "PRA-1", practice_number: 77 },
          principals: { business_name: "Alfa" },
          clients: {
            kind: "company",
            first_name: null,
            last_name: null,
            business_name: "Cliente Uno",
          },
          counterparties: {
            kind: "individual",
            first_name: "Lia",
            last_name: "Verdi",
            business_name: null,
          },
        },
      ],
      reviews: [],
    });

    const candidateWithoutReview = {
      entityType: "client",
      left: { id: "client-1", label: "Cliente Uno" },
      right: { id: "client-2", label: "Cliente Due" },
      score: 0.91,
      confidence: "high",
      reasons: ["ragione"],
      status: "open",
      reviewId: null,
      detectedAt: null,
      resolvedAt: null,
      snoozedUntil: null,
    };
    const candidateWithReview = {
      entityType: "client",
      left: { id: "client-3", label: "Cliente Tre" },
      right: { id: "client-4", label: "Cliente Quattro" },
      score: 0.75,
      confidence: "medium",
      reasons: ["esistente"],
      status: "open",
      reviewId: "review-existing",
      detectedAt: "2026-06-03T09:00:00.000Z",
      resolvedAt: null,
      snoozedUntil: null,
    };

    duplicateLogicMock.scanDuplicateCandidates.mockImplementation((input) => {
      expect(input.clients[0].principalNames).toEqual(["Alfa", "Beta"]);
      expect(input.counterparties[0].subjectLabels).toEqual(["Studio Delta"]);
      expect(input.counterpartySubjects[0]).toMatchObject({
        counterpartyPublicCode: "CTP-1",
        counterpartyName: "Lia Verdi",
      });
      expect(input.cases[0]).toMatchObject({
        principalName: "Alfa",
        clientName: "Cliente Uno",
        counterpartyName: "Lia Verdi",
      });
      expect(input.activities[0]).toMatchObject({
        casePublicCode: "PRA-1",
        casePracticeNumber: 77,
        principalName: "Alfa",
        clientName: "Cliente Uno",
        counterpartyName: "Lia Verdi",
      });
      return {
        openCandidates: [candidateWithoutReview, candidateWithReview],
        resolvedCandidates: [],
      };
    });
    duplicateLogicMock.reviewInsertFromCandidate.mockReturnValue({
      entity_type: "client",
      left_record_id: "client-1",
      right_record_id: "client-2",
      score: 0.91,
      confidence: "high",
      reasons: ["ragione"],
      status: "open",
    });
    supabase.queue("duplicate_reviews:upsert:many", {
      data: [
        {
          id: "review-new",
          entity_type: "client",
          left_record_id: "client-1",
          right_record_id: "client-2",
          detected_at: "2026-06-03T10:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await handlerOf<
      { context: { supabase: FakeSupabase; userId: string } },
      { openCandidates: Array<Record<string, unknown>>; resolvedCandidates: unknown[] }
    >(scanDuplicateCandidatesFn)({
      context: { supabase, userId: "user-1" },
    });

    expect(result.openCandidates).toEqual([
      {
        ...candidateWithoutReview,
        reviewId: "review-new",
        detectedAt: "2026-06-03T10:00:00.000Z",
      },
      candidateWithReview,
    ]);
    expect(result.resolvedCandidates).toEqual([]);
    expect(duplicateLogicMock.reviewInsertFromCandidate).toHaveBeenCalledTimes(1);
    expect(supabase.callsFor("duplicate_reviews", "upsert")[0]).toMatchObject({
      payload: [
        {
          entity_type: "client",
          left_record_id: "client-1",
          right_record_id: "client-2",
          score: 0.91,
          confidence: "high",
          reasons: ["ragione"],
          status: "open",
        },
      ],
      options: {
        ignoreDuplicates: true,
        onConflict: "user_id,entity_type,left_record_id,right_record_id",
      },
    });
  });

  it("calcola il riepilogo tra aperti, alta confidenza, snoozed e risolti", async () => {
    const supabase = new FakeSupabase();
    queueScanData(supabase);
    duplicateLogicMock.scanDuplicateCandidates.mockReturnValue({
      openCandidates: [
        {
          entityType: "client",
          left: { id: "a", label: "A" },
          right: { id: "b", label: "B" },
          score: 0.91,
          confidence: "high",
          reasons: [],
          status: "open",
        },
        {
          entityType: "client",
          left: { id: "c", label: "C" },
          right: { id: "d", label: "D" },
          score: 0.8,
          confidence: "medium",
          reasons: [],
          status: "open",
        },
        {
          entityType: "client",
          left: { id: "e", label: "E" },
          right: { id: "f", label: "F" },
          score: 0.8,
          confidence: "medium",
          reasons: [],
          status: "snoozed",
        },
      ],
      resolvedCandidates: [{ id: "resolved-1" }, { id: "resolved-2" }],
    });

    await expect(
      handlerOf<
        { context: { supabase: FakeSupabase; userId: string } },
        {
          openCount: number;
          highConfidenceCount: number;
          snoozedCount: number;
          resolvedCount: number;
        }
      >(getDuplicateSummaryFn)({
        context: { supabase, userId: "user-1" },
      }),
    ).resolves.toEqual({
      openCount: 2,
      highConfidenceCount: 1,
      snoozedCount: 1,
      resolvedCount: 2,
    });
    expect(supabase.callsFor("case_activities", "select")[0].limit).toBe(501);
  });

  it("rifiuta dataset oltre il limite prima del confronto quadratico", async () => {
    const supabase = new FakeSupabase();
    queueScanData(supabase, {
      principals: Array.from({ length: 501 }, (_, index) => ({
        id: `principal-${index}`,
        business_name: `Committente ${index}`,
      })),
    });

    await expect(
      handlerOf<{ context: { supabase: FakeSupabase; userId: string } }, { openCount: number }>(
        getDuplicateSummaryFn,
      )({
        context: { supabase, userId: "user-1" },
      }),
    ).rejects.toThrow("oltre 500 righe");
    expect(duplicateLogicMock.scanDuplicateCandidates).not.toHaveBeenCalled();
  });

  it("valida il draft input e inoltra a scanDuplicateDraft solo il perimetro necessario", async () => {
    const validateDraft = validatorOf<{ entityType: string; draft: unknown }>(
      findDuplicateCandidatesFn,
    );
    expect(() => validateDraft({ entityType: "bogus", draft: {} })).toThrow(
      "Tipo duplicato non valido",
    );
    expect(() => validateDraft({ entityType: "client", draft: null })).toThrow(
      "Dati da controllare non validi",
    );

    const supabase = new FakeSupabase();
    queueScanData(supabase, {
      principals: [{ id: "principal-1", public_code: "COM-1", business_name: "Alfa" }],
      clients: [{ id: "client-1", public_code: "CLI-1", kind: "company", business_name: "Beta" }],
      counterparties: [
        { id: "counterparty-1", public_code: "CTP-1", kind: "company", business_name: "Gamma" },
      ],
      cases: [{ id: "case-1", public_code: "PRA-1", practice_number: 11 }],
    });
    duplicateLogicMock.scanDuplicateDraft.mockReturnValue([{ id: "candidate-1" }]);

    const result = await handlerOf<
      {
        data: { entityType: "client"; draft: { business_name: string } };
        context: { supabase: FakeSupabase; userId: string };
      },
      Array<Record<string, unknown>>
    >(findDuplicateCandidatesFn)({
      data: { entityType: "client", draft: { business_name: "Beta Srl" } },
      context: { supabase, userId: "user-1" },
    });

    expect(result).toEqual([{ id: "candidate-1" }]);
    expect(duplicateLogicMock.scanDuplicateDraft).toHaveBeenCalledWith({
      entityType: "client",
      draft: { business_name: "Beta Srl" },
      principals: [{ id: "principal-1", public_code: "COM-1", business_name: "Alfa" }],
      clients: [
        {
          id: "client-1",
          public_code: "CLI-1",
          kind: "company",
          business_name: "Beta",
          principalNames: [],
        },
      ],
      counterparties: [
        {
          id: "counterparty-1",
          public_code: "CTP-1",
          kind: "company",
          business_name: "Gamma",
          subjectLabels: [],
        },
      ],
      cases: [
        {
          id: "case-1",
          public_code: "PRA-1",
          practice_number: 11,
          principalName: null,
          clientName: null,
          counterpartyName: null,
        },
      ],
    });
  });

  it("non blocca il controllo in creazione quando le attività superano il limite", async () => {
    const supabase = new FakeSupabase();
    queueScanData(supabase, {
      clients: [{ id: "client-1", public_code: "CLI-1", kind: "company", business_name: "Beta" }],
      activities: Array.from({ length: 501 }, (_, index) => ({ id: `activity-${index}` })),
      reviews: Array.from({ length: 501 }, (_, index) => ({ id: `review-${index}` })),
    });
    duplicateLogicMock.scanDuplicateDraft.mockReturnValue([]);

    await expect(
      handlerOf<
        {
          data: { entityType: "client"; draft: { business_name: string } };
          context: { supabase: FakeSupabase; userId: string };
        },
        unknown
      >(findDuplicateCandidatesFn)({
        data: { entityType: "client", draft: { business_name: "Beta Srl" } },
        context: { supabase, userId: "user-1" },
      }),
    ).resolves.toEqual([]);

    expect(supabase.callsFor("case_activities", "select")).toHaveLength(0);
    expect(supabase.callsFor("duplicate_reviews", "select")).toHaveLength(0);
  });

  it("normalizza la coppia in ordine lessicografico e calcola lo snooze", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T10:00:00.000Z"));

    const supabase = new FakeSupabase();
    supabase.queue("duplicate_reviews:update:single", {
      data: { id: "review-1", status: "snoozed" },
      error: null,
    });

    const result = await handlerOf<
      {
        data: {
          entityType: "client";
          leftRecordId: string;
          rightRecordId: string;
          action: "snooze";
          snoozeInterval: "1w";
        };
        context: { supabase: FakeSupabase; userId: string };
      },
      Record<string, unknown>
    >(resolveDuplicateCandidateFn)({
      data: {
        entityType: "client",
        leftRecordId: "right-id",
        rightRecordId: "left-id",
        action: "snooze",
        snoozeInterval: "1w",
      },
      context: { supabase, userId: "user-1" },
    });

    expect(result).toEqual({ id: "review-1", status: "snoozed" });
    expect(supabase.callsFor("duplicate_reviews", "update")[0]).toMatchObject({
      payload: {
        status: "snoozed",
        kept_record_id: null,
        merged_record_id: null,
        snoozed_until: "2026-06-10T10:00:00.000Z",
        resolved_at: null,
      },
      filters: [
        ["user_id", "user-1"],
        ["entity_type", "client"],
        ["left_record_id", "left-id"],
        ["right_record_id", "right-id"],
      ],
    });
  });

  it("valida l'input di risoluzione per mergeability, azione e intervallo", () => {
    const validateResolve = validatorOf<{
      entityType: string;
      leftRecordId?: string;
      rightRecordId?: string;
      action: string;
      keepRecordId?: string | null;
      snoozeInterval?: string | null;
    }>(resolveDuplicateCandidateFn);

    expect(() =>
      validateResolve({
        entityType: "activity",
        leftRecordId: "a",
        rightRecordId: "b",
        action: "merge",
        keepRecordId: "a",
      }),
    ).toThrow("Questo tipo di sospetto non supporta l'unione automatica");

    expect(() =>
      validateResolve({
        entityType: "client",
        leftRecordId: "a",
        rightRecordId: "b",
        action: "archive",
      }),
    ).toThrow("Azione duplicato non valida");

    expect(() =>
      validateResolve({
        entityType: "client",
        leftRecordId: "a",
        rightRecordId: "b",
        action: "snooze",
        snoozeInterval: "2d",
      }),
    ).toThrow("Intervallo promemoria non valido");

    expect(() =>
      validateResolve({
        entityType: "client",
        leftRecordId: "",
        rightRecordId: "b",
        action: "dismiss",
      }),
    ).toThrow("Coppia duplicato non valida");

    expect(() =>
      validateResolve({
        entityType: "client",
        leftRecordId: "a",
        rightRecordId: "a",
        action: "dismiss",
      }),
    ).toThrow("devono essere distinti");
  });

  it("delega merge e decisione a una sola RPC atomica", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("merge_duplicate_records:rpc", {
      data: {
        id: "review-case",
        status: "merged",
        kept_record_id: "case-keep",
        merged_record_id: "case-merge",
      },
      error: null,
    });

    await expect(
      handlerOf<
        {
          data: {
            entityType: "case";
            leftRecordId: string;
            rightRecordId: string;
            action: "merge";
            keepRecordId: string;
          };
          context: { supabase: FakeSupabase; userId: string };
        },
        unknown
      >(resolveDuplicateCandidateFn)({
        data: {
          entityType: "case",
          leftRecordId: "case-keep",
          rightRecordId: "case-merge",
          action: "merge",
          keepRecordId: "case-keep",
        },
        context: { supabase, userId: "user-1" },
      }),
    ).resolves.toMatchObject({ id: "review-case", status: "merged" });

    expect(supabase.callsFor("merge_duplicate_records", "rpc")).toEqual([
      {
        table: "merge_duplicate_records",
        action: "rpc",
        payload: {
          p_entity_type: "case",
          p_left_record_id: "case-keep",
          p_right_record_id: "case-merge",
          p_kept_record_id: "case-keep",
        },
        filters: [],
      },
    ]);
    expect(supabase.callsFor("duplicate_reviews", "update")).toHaveLength(0);
  });

  it("propaga l'errore della transazione di merge senza registrare una decisione separata", async () => {
    const supabase = new FakeSupabase();
    supabase.queue("merge_duplicate_records:rpc", {
      data: null,
      error: new Error("merge failed"),
    });

    await expect(
      handlerOf<
        {
          data: {
            entityType: "client";
            leftRecordId: string;
            rightRecordId: string;
            action: "merge";
            keepRecordId: string;
          };
          context: { supabase: FakeSupabase; userId: string };
        },
        unknown
      >(resolveDuplicateCandidateFn)({
        data: {
          entityType: "client",
          leftRecordId: "client-keep",
          rightRecordId: "client-merge",
          action: "merge",
          keepRecordId: "client-keep",
        },
        context: { supabase, userId: "user-1" },
      }),
    ).rejects.toThrow("merge failed");

    expect(supabase.callsFor("duplicate_reviews", "update")).toHaveLength(0);
  });
});
