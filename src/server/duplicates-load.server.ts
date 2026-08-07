import { asDuplicateDb } from "@/server/duplicates-db.server";
import type {
  ActivityDuplicateRow,
  CaseDuplicateRow,
  ClientDuplicateRow,
  CounterpartyDuplicateRow,
  CounterpartySubjectDuplicateRow,
  DuplicateReviewRow,
  PrincipalDuplicateRow,
} from "@/server/duplicates.logic";

type DuplicateSubjectLabelRow = {
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
};

type ActivityScanRow = ActivityDuplicateRow & {
  cases: { public_code: string | null; practice_number: number } | null;
  principals: { business_name: string } | null;
  clients: DuplicateSubjectLabelRow | null;
  counterparties: DuplicateSubjectLabelRow | null;
};

const MAX_DUPLICATE_SCAN_ROWS = 500;
const DUPLICATE_SCAN_FETCH_LIMIT = MAX_DUPLICATE_SCAN_ROWS + 1;

export async function loadDuplicateScanData(
  client: unknown,
  userId: string,
  scope: "full" | "draft" = "full",
) {
  const db = asDuplicateDb(client);
  const emptyResult = <T>() => Promise.resolve({ data: [] as T, error: null });
  const fullScope = scope === "full";
  const [
    principalsResult,
    clientsResult,
    principalLinksResult,
    counterpartiesResult,
    subjectsResult,
    casesResult,
    activitiesResult,
    reviewsResult,
  ] = await Promise.all([
    db
      .from<PrincipalDuplicateRow[]>("principals")
      .select(
        "id, public_code, business_name, tax_code, vat_number, email, pec, phone, address_city, archived_at",
      )
      .eq("user_id", userId)
      .limit(DUPLICATE_SCAN_FETCH_LIMIT),
    db
      .from<ClientDuplicateRow[]>("clients")
      .select("id, public_code, kind, first_name, last_name, business_name, notes")
      .eq("user_id", userId)
      .limit(DUPLICATE_SCAN_FETCH_LIMIT),
    db
      .from<Array<{ client_id: string; principals: { business_name: string } | null }>>(
        "principal_clients",
      )
      .select("client_id, principals(business_name)")
      .eq("user_id", userId)
      .limit(DUPLICATE_SCAN_FETCH_LIMIT),
    db
      .from<CounterpartyDuplicateRow[]>("counterparties")
      .select("id, public_code, kind, first_name, last_name, business_name, notes")
      .eq("user_id", userId)
      .limit(DUPLICATE_SCAN_FETCH_LIMIT),
    db
      .from<
        Array<{
          id: string;
          counterparty_id: string;
          kind: string;
          first_name: string | null;
          last_name: string | null;
          business_name: string | null;
          notes: string | null;
          position: number;
          counterparties: {
            public_code: string | null;
            kind: string;
            first_name: string | null;
            last_name: string | null;
            business_name: string | null;
          } | null;
        }>
      >("counterparty_subjects")
      .select(
        "id, counterparty_id, kind, first_name, last_name, business_name, notes, position, counterparties(public_code, kind, first_name, last_name, business_name)",
      )
      .eq("user_id", userId)
      .limit(DUPLICATE_SCAN_FETCH_LIMIT),
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
        "id, public_code, practice_number, principal_id, client_id, counterparty_id, authority, rg_number, opened_at, status, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
      )
      .eq("user_id", userId)
      .limit(DUPLICATE_SCAN_FETCH_LIMIT),
    fullScope
      ? db
          .from<ActivityScanRow[]>("case_activities")
          .select(
            "id, case_id, principal_id, client_id, counterparty_id, price_item_id, invoice_id, activity_date, kind, status, snapshot_price_code, snapshot_price_name, description, quantity, unit_price, amount, cases(public_code, practice_number), principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
          )
          .eq("user_id", userId)
          .limit(DUPLICATE_SCAN_FETCH_LIMIT)
      : emptyResult<ActivityScanRow[]>(),
    fullScope
      ? db
          .from<DuplicateReviewRow[]>("duplicate_reviews")
          .select("*")
          .eq("user_id", userId)
          .limit(DUPLICATE_SCAN_FETCH_LIMIT)
      : emptyResult<DuplicateReviewRow[]>(),
  ]);

  for (const result of [
    principalsResult,
    clientsResult,
    principalLinksResult,
    counterpartiesResult,
    subjectsResult,
    casesResult,
    activitiesResult,
    reviewsResult,
  ]) {
    if (result.error) throw result.error;
  }

  // ponytail: limite per tabella; massimo produzione 76 righe al 2026-08-07.
  // Passare a blocking/index DB se un singolo utente supera 500 righe.
  if (
    [
      principalsResult,
      clientsResult,
      principalLinksResult,
      counterpartiesResult,
      subjectsResult,
      casesResult,
      activitiesResult,
      reviewsResult,
    ].some((result) => (result.data?.length ?? 0) > MAX_DUPLICATE_SCAN_ROWS)
  ) {
    throw new Error(
      "Controllo duplicati non disponibile per insiemi oltre 500 righe. Riduci i dati archiviati e riprova.",
    );
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
    counterpartySubjects: (subjectsResult.data ?? []).map(
      (subject): CounterpartySubjectDuplicateRow => ({
        id: subject.id,
        counterparty_id: subject.counterparty_id,
        kind: subject.kind,
        first_name: subject.first_name,
        last_name: subject.last_name,
        business_name: subject.business_name,
        notes: subject.notes,
        position: subject.position,
        counterpartyPublicCode: subject.counterparties?.public_code ?? null,
        counterpartyName: subject.counterparties
          ? duplicateCounterpartyLabel(subject.counterparties)
          : null,
      }),
    ),
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
    activities: (activitiesResult.data ?? []).map((activity) => ({
      ...activity,
      casePublicCode: activity.cases?.public_code ?? null,
      casePracticeNumber: activity.cases?.practice_number ?? null,
      principalName: activity.principals?.business_name ?? null,
      clientName: activity.clients ? duplicateClientLabel(activity.clients) : null,
      counterpartyName: activity.counterparties
        ? duplicateCounterpartyLabel(activity.counterparties)
        : null,
    })),
    reviews: reviewsResult.data ?? [],
  };
}

function duplicateClientLabel(client: {
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
}) {
  return client.kind === "company"
    ? client.business_name
    : [client.first_name, client.last_name].filter(Boolean).join(" ");
}

function duplicateCounterpartyLabel(counterparty: {
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
}) {
  return counterparty.kind === "individual"
    ? [counterparty.first_name, counterparty.last_name].filter(Boolean).join(" ")
    : counterparty.business_name;
}
