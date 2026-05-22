import {
  buildCandidate,
  businessNameSimilarity,
  canonicalPair,
  displayDuplicateEntity,
  duplicateEntityPath,
  duplicatePairKey,
  personNameSimilarity,
  textSimilarity,
  type DuplicateCandidate,
  type DuplicateConfidence,
  type DuplicateEntityType,
  type DuplicateRecord,
  type DuplicateReviewStatus,
} from "@/lib/duplicate-matching";
import { clientDisplayName, counterpartyDisplayName } from "@/lib/labels";

export type PrincipalDuplicateRow = {
  id: string;
  public_code: string | null;
  business_name: string;
  tax_code?: string | null;
  vat_number?: string | null;
  email?: string | null;
  pec?: string | null;
  phone?: string | null;
  address_city?: string | null;
  archived_at?: string | null;
};

export type ClientDuplicateRow = {
  id: string;
  public_code: string | null;
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  email?: string | null;
  notes?: string | null;
  principalNames?: string[];
};

export type CounterpartyDuplicateRow = {
  id: string;
  public_code: string | null;
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  notes?: string | null;
  subjectLabels?: string[];
};

export type CaseDuplicateRow = {
  id: string;
  public_code: string | null;
  practice_number: number;
  title: string;
  principal_id?: string | null;
  client_id?: string | null;
  counterparty_id?: string | null;
  authority?: string | null;
  rg_number?: string | null;
  opened_at?: string | null;
  status?: string | null;
  principalName?: string | null;
  clientName?: string | null;
  counterpartyName?: string | null;
};

export type DuplicateReviewRow = {
  id: string;
  entity_type: DuplicateEntityType;
  left_record_id: string;
  right_record_id: string;
  score: number;
  confidence: DuplicateConfidence;
  reasons: string[];
  status: DuplicateReviewStatus;
  kept_record_id?: string | null;
  merged_record_id?: string | null;
  detected_at?: string | null;
  resolved_at?: string | null;
  snapshot?: {
    left?: DuplicateRecord;
    right?: DuplicateRecord;
  } | null;
};

export type DuplicateScanInput = {
  principals: PrincipalDuplicateRow[];
  clients: ClientDuplicateRow[];
  counterparties: CounterpartyDuplicateRow[];
  cases: CaseDuplicateRow[];
  reviews: DuplicateReviewRow[];
};

const TOOL_THRESHOLD = 0.62;
const FORM_THRESHOLD = 0.74;

export function scanDuplicateCandidates(input: DuplicateScanInput) {
  const reviewsByPair = new Map(
    input.reviews.map((review) => [
      duplicatePairKey(review.entity_type, review.left_record_id, review.right_record_id),
      review,
    ]),
  );

  const generated = [
    ...pairwise(input.principals, scorePrincipalPair),
    ...pairwise(input.clients, scoreClientPair),
    ...pairwise(input.counterparties, scoreCounterpartyPair),
    ...pairwise(input.cases, scoreCasePair),
  ];

  const openCandidates = generated
    .map((candidate) => attachReview(candidate, reviewsByPair))
    .filter((candidate) => candidate.status !== "dismissed" && candidate.status !== "merged")
    .sort(sortDuplicateCandidates);

  const generatedKeys = new Set(
    generated.map((candidate) =>
      duplicatePairKey(candidate.entityType, candidate.left.id, candidate.right.id),
    ),
  );

  const resolvedCandidates = input.reviews
    .filter((review) => review.status === "dismissed" || review.status === "merged")
    .map(reviewToCandidate)
    .filter(Boolean)
    .filter((candidate): candidate is DuplicateCandidate => Boolean(candidate))
    .filter(
      (candidate) =>
        !generatedKeys.has(
          duplicatePairKey(candidate.entityType, candidate.left.id, candidate.right.id),
        ) ||
        candidate.status === "dismissed" ||
        candidate.status === "merged",
    )
    .sort(sortDuplicateCandidates);

  return {
    openCandidates,
    resolvedCandidates,
    generatedCandidates: generated,
  };
}

export function scanDuplicateDraft(input: {
  entityType: DuplicateEntityType;
  draft: unknown;
  principals?: PrincipalDuplicateRow[];
  clients?: ClientDuplicateRow[];
  counterparties?: CounterpartyDuplicateRow[];
  cases?: CaseDuplicateRow[];
}) {
  const draftId = "draft";
  const draft =
    input.entityType === "principal"
      ? principalRecord({
          ...(input.draft as PrincipalDuplicateRow),
          id: draftId,
          public_code: null,
        })
      : input.entityType === "client"
        ? clientRecord({ ...(input.draft as ClientDuplicateRow), id: draftId, public_code: null })
        : input.entityType === "counterparty"
          ? counterpartyRecord({
              ...(input.draft as CounterpartyDuplicateRow),
              id: draftId,
              public_code: null,
            })
          : caseRecord({ ...(input.draft as CaseDuplicateRow), id: draftId, public_code: null });

  const candidates =
    input.entityType === "principal"
      ? (input.principals ?? [])
          .map((row) => scorePrincipalPair(row, input.draft as PrincipalDuplicateRow, draft))
          .filter(Boolean)
      : input.entityType === "client"
        ? (input.clients ?? [])
            .map((row) => scoreClientPair(row, input.draft as ClientDuplicateRow, draft))
            .filter(Boolean)
        : input.entityType === "counterparty"
          ? (input.counterparties ?? [])
              .map((row) =>
                scoreCounterpartyPair(row, input.draft as CounterpartyDuplicateRow, draft),
              )
              .filter(Boolean)
          : (input.cases ?? [])
              .map((row) => scoreCasePair(row, input.draft as CaseDuplicateRow, draft))
              .filter(Boolean);

  return candidates
    .filter((candidate): candidate is DuplicateCandidate => Boolean(candidate))
    .filter((candidate) => candidate.score >= FORM_THRESHOLD)
    .sort(sortDuplicateCandidates)
    .slice(0, 5);
}

export function reviewInsertFromCandidate(userId: string, candidate: DuplicateCandidate) {
  const [left, right] = canonicalPair(candidate.left.id, candidate.right.id);
  const leftRecord = left === candidate.left.id ? candidate.left : candidate.right;
  const rightRecord = right === candidate.right.id ? candidate.right : candidate.left;

  return {
    user_id: userId,
    entity_type: candidate.entityType,
    left_record_id: left,
    right_record_id: right,
    score: candidate.score,
    confidence: candidate.confidence,
    reasons: candidate.reasons,
    status: candidate.status,
    snapshot: {
      left: leftRecord,
      right: rightRecord,
    },
  };
}

function sortDuplicateCandidates(a: DuplicateCandidate, b: DuplicateCandidate) {
  const statusOrder = { open: 0, snoozed: 1, dismissed: 2, merged: 3 };
  const statusDiff = statusOrder[a.status] - statusOrder[b.status];
  if (statusDiff !== 0) return statusDiff;
  return b.score - a.score || displayDuplicateEntity(a.entityType).localeCompare(b.entityType);
}

function pairwise<T>(rows: T[], scorer: (a: T, b: T) => DuplicateCandidate | null) {
  const candidates: DuplicateCandidate[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const candidate = scorer(rows[i], rows[j]);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

function scorePrincipalPair(
  a: PrincipalDuplicateRow,
  b: PrincipalDuplicateRow,
  draft?: DuplicateRecord,
) {
  const nameScore = businessNameSimilarity(a.business_name, b.business_name);
  const reasons: string[] = [];
  let score = nameScore;
  if (nameScore >= 0.92) reasons.push("Ragione sociale quasi identica");
  else if (nameScore >= 0.74) reasons.push("Ragione sociale molto simile");

  if (sameFilled(a.vat_number, b.vat_number)) {
    score = Math.max(score, 0.98);
    reasons.push("Partita IVA coincidente");
  }
  if (sameFilled(a.tax_code, b.tax_code)) {
    score = Math.max(score, 0.96);
    reasons.push("Codice fiscale coincidente");
  }
  if (sameFilled(a.pec, b.pec) || sameFilled(a.email, b.email)) {
    score = Math.max(score, 0.9);
    reasons.push("Contatto coincidente");
  }
  if (score < TOOL_THRESHOLD || reasons.length === 0) return null;
  return buildCandidate({
    entityType: "principal",
    left: principalRecord(a),
    right: draft ?? principalRecord(b),
    score,
    reasons,
  });
}

function scoreClientPair(a: ClientDuplicateRow, b: ClientDuplicateRow, draft?: DuplicateRecord) {
  const nameScore =
    a.kind === "company" || b.kind === "company"
      ? businessNameSimilarity(a.business_name, b.business_name)
      : personNameSimilarity(
          { firstName: a.first_name, lastName: a.last_name },
          { firstName: b.first_name, lastName: b.last_name },
        );
  const reasons: string[] = [];
  let score = nameScore;
  if (nameScore >= 0.92)
    reasons.push(
      a.kind === "company" ? "Ragione sociale quasi identica" : "Nome e cognome molto simili",
    );
  else if (nameScore >= 0.74) reasons.push("Nome molto simile");

  if (sameFilled(a.email, b.email)) {
    score = Math.max(score, 0.96);
    reasons.push("Email coincidente");
  }

  const sharedPrincipal = (a.principalNames ?? []).some((name) =>
    (b.principalNames ?? []).includes(name),
  );
  const finalScore = sharedPrincipal ? Math.max(score, score + 0.06) : score;
  if (sharedPrincipal) reasons.push("Stesso committente collegato");

  if (finalScore < TOOL_THRESHOLD || reasons.length === 0) return null;
  return buildCandidate({
    entityType: "client",
    left: clientRecord(a),
    right: draft ?? clientRecord(b),
    score: finalScore,
    reasons,
  });
}

function scoreCounterpartyPair(
  a: CounterpartyDuplicateRow,
  b: CounterpartyDuplicateRow,
  draft?: DuplicateRecord,
) {
  const score =
    a.kind === "individual" && b.kind === "individual"
      ? personNameSimilarity(
          { firstName: a.first_name, lastName: a.last_name },
          { firstName: b.first_name, lastName: b.last_name },
        )
      : businessNameSimilarity(a.business_name, b.business_name);
  const reasons: string[] = [];
  if (score >= 0.92)
    reasons.push(
      a.kind === "individual" ? "Nome e cognome molto simili" : "Ragione sociale quasi identica",
    );
  else if (score >= 0.74) reasons.push("Nome controparte simile");

  const sharedSubject = (a.subjectLabels ?? []).some((label) =>
    (b.subjectLabels ?? []).some((other) => textSimilarity(label, other) >= 0.9),
  );
  const finalScore = sharedSubject ? Math.max(score, score + 0.08) : score;
  if (sharedSubject) reasons.push("Soggetto interno simile nella controparte composta");

  if (finalScore < TOOL_THRESHOLD || reasons.length === 0) return null;
  return buildCandidate({
    entityType: "counterparty",
    left: counterpartyRecord(a),
    right: draft ?? counterpartyRecord(b),
    score: finalScore,
    reasons,
  });
}

function scoreCasePair(a: CaseDuplicateRow, b: CaseDuplicateRow, draft?: DuplicateRecord) {
  const reasons: string[] = [];
  let score = 0;
  if (a.practice_number && b.practice_number && a.practice_number === b.practice_number) {
    score = 0.99;
    reasons.push("Numero pratica uguale");
  }
  if (sameFilled(a.rg_number, b.rg_number)) {
    score = Math.max(score, sameFilled(a.authority, b.authority) ? 0.94 : 0.84);
    reasons.push("RG uguale o molto simile");
  }

  const sameContext = a.principal_id === b.principal_id && a.client_id === b.client_id;
  const sameCounterparty = a.counterparty_id && a.counterparty_id === b.counterparty_id;
  if (sameContext && sameCounterparty) {
    score = Math.max(score, 0.9);
    reasons.push("Stessa combinazione committente, cliente e controparte");
  } else if (sameContext && textSimilarity(a.counterpartyName, b.counterpartyName) >= 0.78) {
    score = Math.max(score, 0.8);
    reasons.push("Stesso committente e cliente con controparte simile");
  }

  if (score < TOOL_THRESHOLD || reasons.length === 0) return null;
  return buildCandidate({
    entityType: "case",
    left: caseRecord(a),
    right: draft ?? caseRecord(b),
    score,
    reasons,
  });
}

function attachReview(
  candidate: DuplicateCandidate,
  reviewsByPair: Map<string, DuplicateReviewRow>,
) {
  const review = reviewsByPair.get(
    duplicatePairKey(candidate.entityType, candidate.left.id, candidate.right.id),
  );
  if (!review) return candidate;
  return {
    ...candidate,
    reviewId: review.id,
    status: review.status,
    detectedAt: review.detected_at ?? null,
    resolvedAt: review.resolved_at ?? null,
  };
}

function reviewToCandidate(review: DuplicateReviewRow) {
  const left = review.snapshot?.left;
  const right = review.snapshot?.right;
  if (!left || !right) return null;
  return buildCandidate({
    entityType: review.entity_type,
    left,
    right,
    score: review.score,
    reasons: review.reasons,
    status: review.status,
    reviewId: review.id,
    detectedAt: review.detected_at ?? null,
    resolvedAt: review.resolved_at ?? null,
  });
}

function principalRecord(row: PrincipalDuplicateRow): DuplicateRecord {
  return {
    id: row.id,
    publicCode: row.public_code,
    label: row.business_name || "Committente senza nome",
    subtitle: row.archived_at ? "Archiviato" : row.address_city,
    fields: {
      "Ragione sociale": row.business_name,
      "P.IVA": row.vat_number,
      "Codice fiscale": row.tax_code,
      Email: row.email,
      PEC: row.pec,
      Città: row.address_city,
    },
  };
}

function clientRecord(row: ClientDuplicateRow): DuplicateRecord {
  return {
    id: row.id,
    publicCode: row.public_code,
    label: clientDisplayName(row),
    subtitle: (row.principalNames ?? []).join(", ") || null,
    fields: {
      Tipo: row.kind === "company" ? "Società" : "Privato",
      Nome: [row.first_name, row.last_name].filter(Boolean).join(" "),
      "Ragione sociale": row.business_name,
      Email: row.email,
      Committenti: (row.principalNames ?? []).join(", "),
    },
  };
}

function counterpartyRecord(row: CounterpartyDuplicateRow): DuplicateRecord {
  return {
    id: row.id,
    publicCode: row.public_code,
    label: counterpartyDisplayName(row),
    subtitle: (row.subjectLabels ?? []).length > 0 ? `${row.subjectLabels?.length} soggetti` : null,
    fields: {
      Tipo:
        row.kind === "individual"
          ? "Persona fisica"
          : row.kind === "group"
            ? "Composta"
            : "Società",
      Nome: [row.first_name, row.last_name].filter(Boolean).join(" "),
      "Ragione sociale": row.business_name,
      Soggetti: (row.subjectLabels ?? []).join(", "),
      Note: row.notes,
    },
  };
}

function caseRecord(row: CaseDuplicateRow): DuplicateRecord {
  return {
    id: row.id,
    publicCode: row.public_code,
    label: row.practice_number ? `Pratica ${row.practice_number}` : "Pratica",
    subtitle: [row.principalName, row.clientName, row.counterpartyName].filter(Boolean).join(" · "),
    fields: {
      "Numero pratica": row.practice_number,
      Committente: row.principalName,
      Cliente: row.clientName,
      Controparte: row.counterpartyName,
      Autorità: row.authority,
      RG: row.rg_number,
      Stato: row.status,
    },
  };
}

function sameFilled(a: string | null | undefined, b: string | null | undefined) {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  return Boolean(left && right && left === right);
}

export function resolvedStatusLabel(status: DuplicateReviewStatus) {
  const labels: Record<DuplicateReviewStatus, string> = {
    open: "Aperto",
    snoozed: "Rimandato",
    dismissed: "Non duplicato",
    merged: "Unito",
  };
  return labels[status];
}

export function confidenceLabel(confidence: DuplicateConfidence) {
  const labels: Record<DuplicateConfidence, string> = {
    high: "Alta",
    medium: "Media",
    low: "Bassa",
  };
  return labels[confidence];
}

function mergeSummaryLabel(entityType: DuplicateEntityType) {
  return `Unione ${displayDuplicateEntity(entityType).toLowerCase()}`;
}
