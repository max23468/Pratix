import { canMergeDuplicateEntity, type DuplicateEntityType } from "@/lib/duplicate-matching";
import { asDuplicateDb, type UntypedSupabase } from "@/server/duplicates-db.server";
import type { ClientDuplicateRow, CounterpartyDuplicateRow } from "@/server/duplicates.logic";

export async function mergeRecords(
  client: unknown,
  userId: string,
  entityType: DuplicateEntityType,
  keptId: string,
  mergedId: string,
) {
  if (!canMergeDuplicateEntity(entityType)) {
    throw new Error("Questo tipo di sospetto non supporta l'unione automatica");
  }
  if (entityType === "principal") return mergePrincipals(client, userId, keptId, mergedId);
  if (entityType === "client") return mergeClients(client, userId, keptId, mergedId);
  if (entityType === "counterparty") return mergeCounterparties(client, userId, keptId, mergedId);
  return mergeCases(client, userId, keptId, mergedId);
}

async function mergePrincipals(client: unknown, userId: string, keptId: string, mergedId: string) {
  const db = asDuplicateDb(client);
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
  const db = asDuplicateDb(client);
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
  const db = asDuplicateDb(client);
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

  await Promise.all(
    (mergedSubjects ?? []).map(async (subject, index) => {
      const { error } = await db
        .from("counterparty_subjects")
        .update({ counterparty_id: keptCounterpartyId, position: nextPosition + index })
        .eq("user_id", userId)
        .eq("id", subject.id);
      if (error) throw error;
    }),
  );
}

async function mergeCases(client: unknown, userId: string, keptId: string, mergedId: string) {
  const db = asDuplicateDb(client);
  const { data: keptCase, error } = await db
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
  if (error) throw error;
  if (!keptCase) throw new Error("Pratica da mantenere non trovata");

  await Promise.all([
    updateTable(
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
    ),
    updateTable(
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
    ),
    updateTable(db, "case_status_history", { case_id: keptId }, userId, "case_id", mergedId),
    updateTable(db, "case_credit_transfers", { case_id: keptId }, userId, "case_id", mergedId),
  ]);

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

  await Promise.all(
    (links ?? []).map(async (link) => {
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
    }),
  );
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

  await Promise.all(
    (links ?? []).map(async (link) => {
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
    }),
  );
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
  const movableIds = (mergedBooks ?? []).flatMap((book) =>
    keptYears.has(book.year) ? [] : [book.id],
  );
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
