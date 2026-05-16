import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  duplicatePairKey,
  type DuplicateCandidate,
  type DuplicateEntityType,
  type DuplicateReviewStatus,
} from "@/lib/duplicate-matching";
import {
  reviewInsertFromCandidate,
  scanDuplicateCandidates,
  scanDuplicateDraft,
  type CaseDuplicateRow,
  type ClientDuplicateRow,
  type CounterpartyDuplicateRow,
  type DuplicateReviewRow,
  type PrincipalDuplicateRow,
} from "@/server/duplicates.logic";

type UntypedResponse<T> = {
  data: T | null;
  error: Error | null;
};

type UntypedQuery<T = unknown> = PromiseLike<UntypedResponse<T>> & {
  select: (columns?: string) => UntypedQuery<T>;
  insert: (values: unknown) => UntypedQuery<T>;
  upsert: (values: unknown, options?: Record<string, unknown>) => UntypedQuery<T>;
  update: (values: unknown) => UntypedQuery<T>;
  delete: () => UntypedQuery<T>;
  eq: (column: string, value: unknown) => UntypedQuery<T>;
  in: (column: string, values: unknown[]) => UntypedQuery<T>;
  is: (column: string, value: unknown) => UntypedQuery<T>;
  order: (column: string, options?: Record<string, unknown>) => UntypedQuery<T>;
  limit: (count: number) => UntypedQuery<T>;
  single: () => PromiseLike<UntypedResponse<T>>;
  maybeSingle: () => PromiseLike<UntypedResponse<T>>;
};

type UntypedSupabase = {
  from: <T = unknown>(table: string) => UntypedQuery<T>;
};

type FindDuplicateDraftInput = {
  entityType: DuplicateEntityType;
  draft: Record<string, unknown>;
};

type ResolveDuplicateInput = {
  reviewId?: string | null;
  entityType: DuplicateEntityType;
  leftRecordId: string;
  rightRecordId: string;
  action: "snooze" | "dismiss" | "merge";
  keepRecordId?: string | null;
};

export type DuplicateSummaryResult = {
  openCount: number;
  highConfidenceCount: number;
  snoozedCount: number;
  resolvedCount: number;
};

const asDb = (client: unknown) => client as UntypedSupabase;

export const scanDuplicateCandidatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const data = await loadDuplicateScanData(context.supabase, context.userId);
    const scan = scanDuplicateCandidates(data);

    const inserted = await persistOpenCandidates(
      context.supabase,
      context.userId,
      scan.openCandidates,
    );
    const reviewsByPair = new Map(
      inserted.map((review) => [
        duplicatePairKey(review.entity_type, review.left_record_id, review.right_record_id),
        review,
      ]),
    );

    return {
      openCandidates: scan.openCandidates.map((candidate) => {
        if (candidate.reviewId) return candidate;
        const review = reviewsByPair.get(
          duplicatePairKey(candidate.entityType, candidate.left.id, candidate.right.id),
        );
        return review
          ? { ...candidate, reviewId: review.id, detectedAt: review.detected_at }
          : candidate;
      }),
      resolvedCandidates: scan.resolvedCandidates,
    };
  });

export const getDuplicateSummaryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DuplicateSummaryResult> => {
    const data = await loadDuplicateScanData(context.supabase, context.userId);
    const scan = scanDuplicateCandidates(data);
    const open = scan.openCandidates.filter((candidate) => candidate.status === "open");
    return {
      openCount: open.length,
      highConfidenceCount: open.filter((candidate) => candidate.confidence === "high").length,
      snoozedCount: scan.openCandidates.filter((candidate) => candidate.status === "snoozed")
        .length,
      resolvedCount: scan.resolvedCandidates.length,
    };
  });

export const findDuplicateCandidatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateFindDuplicateDraftInput)
  .handler(async ({ data, context }) => {
    const scanData = await loadDuplicateScanData(context.supabase, context.userId);
    return scanDuplicateDraft({
      entityType: data.entityType,
      draft: data.draft,
      principals: scanData.principals,
      clients: scanData.clients,
      counterparties: scanData.counterparties,
      cases: scanData.cases,
    });
  });

export const resolveDuplicateCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateResolveDuplicateInput)
  .handler(async ({ data, context }) => {
    const status = statusForAction(data.action);
    let keptRecordId: string | null = null;
    let mergedRecordId: string | null = null;

    if (data.action === "merge") {
      if (!data.keepRecordId) throw new Error("Scegli il record da mantenere");
      if (![data.leftRecordId, data.rightRecordId].includes(data.keepRecordId)) {
        throw new Error("Record da mantenere non valido");
      }
      keptRecordId = data.keepRecordId;
      mergedRecordId =
        data.keepRecordId === data.leftRecordId ? data.rightRecordId : data.leftRecordId;
      await mergeRecords(
        supabaseAdmin,
        context.userId,
        data.entityType,
        keptRecordId,
        mergedRecordId,
      );
    }

    const [leftRecordId, rightRecordId] =
      data.leftRecordId < data.rightRecordId
        ? [data.leftRecordId, data.rightRecordId]
        : [data.rightRecordId, data.leftRecordId];

    const query = asDb(context.supabase)
      .from<DuplicateReviewRow>("duplicate_reviews")
      .update({
        status,
        kept_record_id: keptRecordId,
        merged_record_id: mergedRecordId,
        resolved_at: status === "snoozed" ? null : new Date().toISOString(),
      })
      .eq("user_id", context.userId)
      .eq("entity_type", data.entityType)
      .eq("left_record_id", leftRecordId)
      .eq("right_record_id", rightRecordId)
      .select("*")
      .single();

    const { data: review, error } = await query;
    if (error) throw error;
    return review;
  });

async function loadDuplicateScanData(client: unknown, userId: string) {
  const db = asDb(client);
  const [
    principalsResult,
    clientsResult,
    principalLinksResult,
    counterpartiesResult,
    subjectsResult,
    casesResult,
    reviewsResult,
  ] = await Promise.all([
    db
      .from<PrincipalDuplicateRow[]>("principals")
      .select(
        "id, public_code, business_name, tax_code, vat_number, email, pec, phone, address_city, archived_at",
      )
      .eq("user_id", userId),
    db
      .from<ClientDuplicateRow[]>("clients")
      .select("id, public_code, kind, first_name, last_name, business_name, notes")
      .eq("user_id", userId),
    db
      .from<
        Array<{ client_id: string; principals: { business_name: string } | null }>
      >("principal_clients")
      .select("client_id, principals(business_name)")
      .eq("user_id", userId),
    db
      .from<CounterpartyDuplicateRow[]>("counterparties")
      .select("id, public_code, kind, first_name, last_name, business_name, notes")
      .eq("user_id", userId),
    db
      .from<
        Array<{
          counterparty_id: string;
          kind: string;
          first_name: string | null;
          last_name: string | null;
          business_name: string | null;
        }>
      >("counterparty_subjects")
      .select("counterparty_id, kind, first_name, last_name, business_name")
      .eq("user_id", userId),
    db
      .from<
        Array<
          CaseDuplicateRow & {
            principals: { business_name: string } | null;
            clients: {
              kind: string;
              first_name: string | null;
              last_name: string | null;
              business_name: string | null;
            } | null;
            counterparties: {
              kind: string;
              first_name: string | null;
              last_name: string | null;
              business_name: string | null;
            } | null;
          }
        >
      >("cases")
      .select(
        "id, public_code, practice_number, title, principal_id, client_id, counterparty_id, authority, rg_number, opened_at, status, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
      )
      .eq("user_id", userId),
    db.from<DuplicateReviewRow[]>("duplicate_reviews").select("*").eq("user_id", userId),
  ]);

  for (const result of [
    principalsResult,
    clientsResult,
    principalLinksResult,
    counterpartiesResult,
    subjectsResult,
    casesResult,
    reviewsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const principalNamesByClient = new Map<string, string[]>();
  for (const link of principalLinksResult.data ?? []) {
    const name = link.principals?.business_name;
    if (!name) continue;
    principalNamesByClient.set(link.client_id, [
      ...(principalNamesByClient.get(link.client_id) ?? []),
      name,
    ]);
  }

  const subjectLabelsByCounterparty = new Map<string, string[]>();
  for (const subject of subjectsResult.data ?? []) {
    const label =
      subject.kind === "company"
        ? subject.business_name
        : [subject.first_name, subject.last_name].filter(Boolean).join(" ");
    if (!label) continue;
    subjectLabelsByCounterparty.set(subject.counterparty_id, [
      ...(subjectLabelsByCounterparty.get(subject.counterparty_id) ?? []),
      label,
    ]);
  }

  return {
    principals: principalsResult.data ?? [],
    clients: (clientsResult.data ?? []).map((client) => ({
      ...client,
      principalNames: principalNamesByClient.get(client.id) ?? [],
    })),
    counterparties: (counterpartiesResult.data ?? []).map((counterparty) => ({
      ...counterparty,
      subjectLabels: subjectLabelsByCounterparty.get(counterparty.id) ?? [],
    })),
    cases: (casesResult.data ?? []).map((caseRow) => ({
      ...caseRow,
      principalName: caseRow.principals?.business_name ?? null,
      clientName: caseRow.clients
        ? caseRow.clients.kind === "company"
          ? caseRow.clients.business_name
          : [caseRow.clients.first_name, caseRow.clients.last_name].filter(Boolean).join(" ")
        : null,
      counterpartyName: caseRow.counterparties
        ? caseRow.counterparties.kind === "individual"
          ? [caseRow.counterparties.first_name, caseRow.counterparties.last_name]
              .filter(Boolean)
              .join(" ")
          : caseRow.counterparties.business_name
        : null,
    })),
    reviews: reviewsResult.data ?? [],
  };
}

async function persistOpenCandidates(
  client: unknown,
  userId: string,
  candidates: DuplicateCandidate[],
) {
  const rows = candidates
    .filter((candidate) => !candidate.reviewId)
    .map((candidate) => reviewInsertFromCandidate(userId, candidate));
  if (rows.length === 0) return [];

  const { data, error } = await asDb(client)
    .from<DuplicateReviewRow[]>("duplicate_reviews")
    .upsert(rows, {
      onConflict: "user_id,entity_type,left_record_id,right_record_id",
      ignoreDuplicates: true,
    })
    .select("*");
  if (error) throw error;
  return data ?? [];
}

async function mergeRecords(
  client: unknown,
  userId: string,
  entityType: DuplicateEntityType,
  keptId: string,
  mergedId: string,
) {
  if (entityType === "principal") return mergePrincipals(client, userId, keptId, mergedId);
  if (entityType === "client") return mergeClients(client, userId, keptId, mergedId);
  if (entityType === "counterparty") return mergeCounterparties(client, userId, keptId, mergedId);
  return mergeCases(client, userId, keptId, mergedId);
}

async function mergePrincipals(client: unknown, userId: string, keptId: string, mergedId: string) {
  const db = asDb(client);
  await updateTable(db, "cases", { principal_id: keptId }, userId, "principal_id", mergedId);
  await updateTable(
    db,
    "case_activities",
    { principal_id: keptId },
    userId,
    "principal_id",
    mergedId,
  );
  await updateTable(db, "invoices", { principal_id: keptId }, userId, "principal_id", mergedId);
  await updateTable(db, "billing_runs", { principal_id: keptId }, userId, "principal_id", mergedId);
  await mergePrincipalClientLinks(db, userId, keptId, mergedId);
  await mergePriceBooks(db, userId, keptId, mergedId);
  await updateTable(
    db,
    "principals",
    { archived_at: new Date().toISOString() },
    userId,
    "id",
    mergedId,
  );
}

async function mergeClients(client: unknown, userId: string, keptId: string, mergedId: string) {
  const db = asDb(client);
  await updateTable(db, "cases", { client_id: keptId }, userId, "client_id", mergedId);
  await updateTable(db, "case_activities", { client_id: keptId }, userId, "client_id", mergedId);
  await updateTable(db, "invoices", { client_id: keptId }, userId, "client_id", mergedId);
  await updateTable(
    db,
    "case_credit_transfers",
    { previous_client_id: keptId },
    userId,
    "previous_client_id",
    mergedId,
  );
  await updateTable(
    db,
    "case_credit_transfers",
    { new_client_id: keptId },
    userId,
    "new_client_id",
    mergedId,
  );
  await mergePrincipalClientLinksForClient(db, userId, keptId, mergedId);
  if (await canDeleteMinimalClient(db, userId, mergedId)) {
    await db.from("clients").delete().eq("user_id", userId).eq("id", mergedId);
  }
}

async function mergeCounterparties(
  client: unknown,
  userId: string,
  keptId: string,
  mergedId: string,
) {
  const db = asDb(client);
  await updateTable(db, "cases", { counterparty_id: keptId }, userId, "counterparty_id", mergedId);
  await moveCounterpartySubjects(db, userId, keptId, mergedId);
  await updateTable(
    db,
    "case_activities",
    { counterparty_id: keptId },
    userId,
    "counterparty_id",
    mergedId,
  );
  if (await canDeleteMinimalCounterparty(db, userId, mergedId)) {
    await db.from("counterparties").delete().eq("user_id", userId).eq("id", mergedId);
  }
}

async function moveCounterpartySubjects(
  db: UntypedSupabase,
  userId: string,
  keptCounterpartyId: string,
  mergedCounterpartyId: string,
) {
  const [{ data: keptSubjects, error: keptError }, { data: mergedSubjects, error: mergedError }] =
    await Promise.all([
      db
        .from<Array<{ position: number }>>("counterparty_subjects")
        .select("position")
        .eq("user_id", userId)
        .eq("counterparty_id", keptCounterpartyId),
      db
        .from<Array<{ id: string; position: number }>>("counterparty_subjects")
        .select("id, position")
        .eq("user_id", userId)
        .eq("counterparty_id", mergedCounterpartyId)
        .order("position", { ascending: true }),
    ]);
  if (keptError) throw keptError;
  if (mergedError) throw mergedError;

  const nextPosition =
    Math.max(-1, ...(keptSubjects ?? []).map((subject) => Number(subject.position))) + 1;

  for (const [index, subject] of (mergedSubjects ?? []).entries()) {
    const { error } = await db
      .from("counterparty_subjects")
      .update({ counterparty_id: keptCounterpartyId, position: nextPosition + index })
      .eq("user_id", userId)
      .eq("id", subject.id);
    if (error) throw error;
  }
}

async function mergeCases(client: unknown, userId: string, keptId: string, mergedId: string) {
  const db = asDb(client);
  const { data: keptCase } = await db
    .from<{
      public_code: string | null;
      practice_number: number;
      principal_id: string | null;
      client_id: string | null;
      counterparty_id: string | null;
    }>("cases")
    .select("public_code, practice_number, principal_id, client_id, counterparty_id")
    .eq("user_id", userId)
    .eq("id", keptId)
    .maybeSingle();
  if (!keptCase) throw new Error("Pratica da mantenere non trovata");

  await updateTable(
    db,
    "case_activities",
    {
      case_id: keptId,
      principal_id: keptCase.principal_id,
      client_id: keptCase.client_id,
      counterparty_id: keptCase.counterparty_id,
    },
    userId,
    "case_id",
    mergedId,
  );
  await updateTable(
    db,
    "invoices",
    {
      case_id: keptId,
      principal_id: keptCase.principal_id,
      client_id: keptCase.client_id,
    },
    userId,
    "case_id",
    mergedId,
  );
  await updateTable(db, "case_status_history", { case_id: keptId }, userId, "case_id", mergedId);
  await updateTable(db, "case_credit_transfers", { case_id: keptId }, userId, "case_id", mergedId);

  const target = keptCase?.public_code || keptCase?.practice_number || keptId;
  await db
    .from("cases")
    .update({
      status: "archived",
      notes: `Pratica assorbita in ${target}.`,
    })
    .eq("user_id", userId)
    .eq("id", mergedId);
}

async function updateTable(
  db: UntypedSupabase,
  table: string,
  values: Record<string, unknown>,
  userId: string,
  column: string,
  value: string,
) {
  const { error } = await db.from(table).update(values).eq("user_id", userId).eq(column, value);
  if (error) throw error;
}

async function mergePrincipalClientLinks(
  db: UntypedSupabase,
  userId: string,
  keptPrincipalId: string,
  mergedPrincipalId: string,
) {
  const { data: links, error } = await db
    .from<Array<{ client_id: string }>>("principal_clients")
    .select("client_id")
    .eq("user_id", userId)
    .eq("principal_id", mergedPrincipalId);
  if (error) throw error;

  for (const link of links ?? []) {
    const { data: existing, error: existingError } = await db
      .from<{ id: string }>("principal_clients")
      .select("id")
      .eq("user_id", userId)
      .eq("principal_id", keptPrincipalId)
      .eq("client_id", link.client_id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      await db
        .from("principal_clients")
        .delete()
        .eq("user_id", userId)
        .eq("principal_id", mergedPrincipalId)
        .eq("client_id", link.client_id);
    } else {
      await db
        .from("principal_clients")
        .update({ principal_id: keptPrincipalId })
        .eq("user_id", userId)
        .eq("principal_id", mergedPrincipalId)
        .eq("client_id", link.client_id);
    }
  }
}

async function mergePrincipalClientLinksForClient(
  db: UntypedSupabase,
  userId: string,
  keptClientId: string,
  mergedClientId: string,
) {
  const { data: links, error } = await db
    .from<Array<{ principal_id: string }>>("principal_clients")
    .select("principal_id")
    .eq("user_id", userId)
    .eq("client_id", mergedClientId);
  if (error) throw error;

  for (const link of links ?? []) {
    const { data: existing, error: existingError } = await db
      .from<{ id: string }>("principal_clients")
      .select("id")
      .eq("user_id", userId)
      .eq("principal_id", link.principal_id)
      .eq("client_id", keptClientId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      await db
        .from("principal_clients")
        .delete()
        .eq("user_id", userId)
        .eq("principal_id", link.principal_id)
        .eq("client_id", mergedClientId);
    } else {
      await db
        .from("principal_clients")
        .update({ client_id: keptClientId })
        .eq("user_id", userId)
        .eq("principal_id", link.principal_id)
        .eq("client_id", mergedClientId);
    }
  }
}

async function mergePriceBooks(
  db: UntypedSupabase,
  userId: string,
  keptPrincipalId: string,
  mergedPrincipalId: string,
) {
  const [{ data: mergedBooks, error: mergedError }, { data: keptBooks, error: keptError }] =
    await Promise.all([
      db
        .from<Array<{ id: string; year: number }>>("price_books")
        .select("id, year")
        .eq("user_id", userId)
        .eq("principal_id", mergedPrincipalId),
      db
        .from<Array<{ year: number }>>("price_books")
        .select("year")
        .eq("user_id", userId)
        .eq("principal_id", keptPrincipalId),
    ]);
  if (mergedError) throw mergedError;
  if (keptError) throw keptError;

  const keptYears = new Set((keptBooks ?? []).map((book) => book.year));
  const movableIds = (mergedBooks ?? [])
    .filter((book) => !keptYears.has(book.year))
    .map((book) => book.id);
  if (movableIds.length === 0) return;
  const { error } = await db
    .from("price_books")
    .update({ principal_id: keptPrincipalId })
    .eq("user_id", userId)
    .in("id", movableIds);
  if (error) throw error;
}

async function canDeleteMinimalClient(db: UntypedSupabase, userId: string, clientId: string) {
  const { data: client, error } = await db
    .from<ClientDuplicateRow>("clients")
    .select("notes")
    .eq("user_id", userId)
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(client && !client.notes);
}

async function canDeleteMinimalCounterparty(
  db: UntypedSupabase,
  userId: string,
  counterpartyId: string,
) {
  const [{ data: counterparty, error }, { data: subjects, error: subjectsError }] =
    await Promise.all([
      db
        .from<CounterpartyDuplicateRow>("counterparties")
        .select("notes")
        .eq("user_id", userId)
        .eq("id", counterpartyId)
        .maybeSingle(),
      db
        .from<Array<{ id: string }>>("counterparty_subjects")
        .select("id")
        .eq("user_id", userId)
        .eq("counterparty_id", counterpartyId)
        .limit(1),
    ]);
  if (error) throw error;
  if (subjectsError) throw subjectsError;
  return Boolean(counterparty && !counterparty.notes && (subjects ?? []).length === 0);
}

function validateFindDuplicateDraftInput(input: FindDuplicateDraftInput) {
  if (!input || typeof input !== "object") throw new Error("Input controllo duplicati non valido");
  if (!["principal", "client", "counterparty", "case"].includes(input.entityType)) {
    throw new Error("Tipo duplicato non valido");
  }
  if (!input.draft || typeof input.draft !== "object") {
    throw new Error("Dati da controllare non validi");
  }
  return input;
}

function validateResolveDuplicateInput(input: ResolveDuplicateInput) {
  if (!input || typeof input !== "object")
    throw new Error("Input risoluzione duplicato non valido");
  if (!["principal", "client", "counterparty", "case"].includes(input.entityType)) {
    throw new Error("Tipo duplicato non valido");
  }
  if (!["snooze", "dismiss", "merge"].includes(input.action)) {
    throw new Error("Azione duplicato non valida");
  }
  if (!input.leftRecordId || !input.rightRecordId) throw new Error("Coppia duplicato non valida");
  return input;
}

function statusForAction(action: ResolveDuplicateInput["action"]): DuplicateReviewStatus {
  if (action === "dismiss") return "dismissed";
  if (action === "merge") return "merged";
  return "snoozed";
}
