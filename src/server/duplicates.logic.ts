import {
  buildCandidate,
  businessNameSimilarity,
  canonicalPair,
  canMergeDuplicateEntity,
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
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseActivityDisplayStatus,
  caseActivityDisplayStatusLabels,
  clientDisplayName,
  counterpartyDisplayName,
  priceItemKindLabels,
} from "@/lib/labels";

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

export type ActivityDuplicateRow = {
  id: string;
  case_id: string;
  principal_id: string;
  client_id: string;
  counterparty_id?: string | null;
  price_item_id?: string | null;
  invoice_id?: string | null;
  activity_date: string;
  kind: string;
  status: string;
  snapshot_price_code?: string | null;
  snapshot_price_name: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  amount: number | string;
  casePublicCode?: string | null;
  casePracticeNumber?: number | null;
  principalName?: string | null;
  clientName?: string | null;
  counterpartyName?: string | null;
};

export type CounterpartySubjectDuplicateRow = {
  id: string;
  counterparty_id: string;
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  notes?: string | null;
  position?: number | null;
  counterpartyPublicCode?: string | null;
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
  snoozed_until?: string | null;
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
  activities?: ActivityDuplicateRow[];
  counterpartySubjects?: CounterpartySubjectDuplicateRow[];
  reviews: DuplicateReviewRow[];
  now?: Date | string;
};

const TOOL_THRESHOLD = 0.62;
const FORM_THRESHOLD = 0.74;
const ACTIVITY_THRESHOLD = 0.78;
const SUBJECT_THRESHOLD = 0.74;
const CROSS_TYPE_THRESHOLD = 0.88;

export function scanDuplicateCandidates(input: DuplicateScanInput) {
  const now = input.now ? new Date(input.now) : new Date();
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
    ...scoreActivityCandidates(input.activities ?? []),
    ...pairwise(input.counterpartySubjects ?? [], scoreCounterpartySubjectPair),
    ...scoreCrossEntityCandidates(input),
  ];

  const openCandidates = generated
    .flatMap((candidate) => {
      const reviewed = attachReview(candidate, reviewsByPair, now);
      return reviewed.status === "dismissed" || reviewed.status === "merged" ? [] : [reviewed];
    })
    .sort(sortDuplicateCandidates);

  const generatedKeys = new Set(
    generated.map((candidate) =>
      duplicatePairKey(candidate.entityType, candidate.left.id, candidate.right.id),
    ),
  );

  const resolvedCandidates = input.reviews
    .flatMap((review) => {
      if (review.status !== "dismissed" && review.status !== "merged") return [];
      const candidate = reviewToCandidate(review);
      if (!candidate) return [];
      const stillResolved =
        !generatedKeys.has(
          duplicatePairKey(candidate.entityType, candidate.left.id, candidate.right.id),
        ) ||
        candidate.status === "dismissed" ||
        candidate.status === "merged";
      return stillResolved ? [candidate] : [];
    })
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
  if (!canMergeDuplicateEntity(input.entityType)) return [];

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
      ? (input.principals ?? []).flatMap((row) => {
          const candidate = scorePrincipalPair(row, input.draft as PrincipalDuplicateRow, draft);
          return candidate ? [candidate] : [];
        })
      : input.entityType === "client"
        ? (input.clients ?? []).flatMap((row) => {
            const candidate = scoreClientPair(row, input.draft as ClientDuplicateRow, draft);
            return candidate ? [candidate] : [];
          })
        : input.entityType === "counterparty"
          ? (input.counterparties ?? []).flatMap((row) => {
              const candidate = scoreCounterpartyPair(
                row,
                input.draft as CounterpartyDuplicateRow,
                draft,
              );
              return candidate ? [candidate] : [];
            })
          : (input.cases ?? []).flatMap((row) => {
              const candidate = scoreCasePair(row, input.draft as CaseDuplicateRow, draft);
              return candidate ? [candidate] : [];
            });

  return candidates
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
    snoozed_until: candidate.snoozedUntil ?? null,
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

function pairwiseFromGroups<T extends { id: string }>(
  groups: Map<string, T[]>,
  scorer: (a: T, b: T) => DuplicateCandidate | null,
) {
  const candidates: DuplicateCandidate[] = [];
  const seen = new Set<string>();
  for (const rows of groups.values()) {
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const [left, right] = canonicalPair(rows[i].id, rows[j].id);
        const key = `${left}:${right}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const candidate = scorer(rows[i], rows[j]);
        if (candidate) candidates.push(candidate);
      }
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

  const principalNames = new Set(b.principalNames ?? []);
  const sharedPrincipal = (a.principalNames ?? []).some((name) => principalNames.has(name));
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

function scoreActivityCandidates(rows: ActivityDuplicateRow[]) {
  const groups = new Map<string, ActivityDuplicateRow[]>();
  const add = (key: string, row: ActivityDuplicateRow) => {
    groups.set(key, [...(groups.get(key) ?? []), row]);
  };

  for (const row of rows) {
    if (!row.activity_date) continue;
    add(`case:${row.case_id}:${row.activity_date}`, row);
    add(
      [
        "context",
        row.principal_id,
        row.client_id,
        row.counterparty_id ?? "none",
        row.activity_date,
      ].join(":"),
      row,
    );
  }

  return pairwiseFromGroups(groups, scoreActivityPair);
}

function scoreActivityPair(a: ActivityDuplicateRow, b: ActivityDuplicateRow) {
  const sameCase = a.case_id === b.case_id;
  const sameOperationalContext =
    a.principal_id === b.principal_id &&
    a.client_id === b.client_id &&
    (a.counterparty_id ?? null) === (b.counterparty_id ?? null);
  if (!sameCase && !sameOperationalContext) return null;

  const sameDate = sameFilled(a.activity_date, b.activity_date);
  if (!sameDate) return null;

  const priceNameScore = textSimilarity(a.snapshot_price_name, b.snapshot_price_name);
  const descriptionScore = textSimilarity(a.description, b.description);
  const samePriceItem = sameFilled(a.price_item_id, b.price_item_id);
  const sameAmount = sameNumber(a.amount, b.amount);
  const sameQuantity = sameNumber(a.quantity, b.quantity);
  const sameKind = a.kind === b.kind;

  const reasons: string[] = [
    sameCase ? "Stessa pratica" : "Stesso committente, cliente e controparte",
    "Stessa data attività",
  ];
  let score = sameCase ? 0.72 : 0.68;

  if (samePriceItem || priceNameScore >= 0.92) {
    score = Math.max(score, 0.84);
    reasons.push("Stessa voce prezzo");
  } else if (priceNameScore >= 0.78) {
    score = Math.max(score, 0.8);
    reasons.push("Voce prezzo simile");
  }

  if (descriptionScore >= 0.92) {
    score = Math.max(score, 0.86);
    reasons.push("Descrizione quasi identica");
  } else if (descriptionScore >= 0.78) {
    score = Math.max(score, 0.8);
    reasons.push("Descrizione simile");
  }

  if (sameAmount) {
    score = Math.max(score, 0.86);
    reasons.push("Importo coincidente");
  }
  if (sameQuantity) reasons.push("Quantità coincidente");
  if (sameKind) reasons.push("Stesso tipo attività");

  if (sameAmount && (samePriceItem || priceNameScore >= 0.9 || descriptionScore >= 0.9)) {
    score = Math.max(score, 0.94);
  } else if (samePriceItem || priceNameScore >= 0.9 || descriptionScore >= 0.9) {
    score = Math.max(score, 0.84);
  }

  if (score < ACTIVITY_THRESHOLD || reasons.length < 4) return null;
  return buildCandidate({
    entityType: "activity",
    left: activityRecord(a),
    right: activityRecord(b),
    score,
    reasons,
  });
}

function scoreCounterpartySubjectPair(
  a: CounterpartySubjectDuplicateRow,
  b: CounterpartySubjectDuplicateRow,
) {
  const score =
    a.kind === "company" || b.kind === "company"
      ? businessNameSimilarity(a.business_name, b.business_name)
      : personNameSimilarity(
          { firstName: a.first_name, lastName: a.last_name },
          { firstName: b.first_name, lastName: b.last_name },
        );
  const sameCounterparty = a.counterparty_id === b.counterparty_id;
  const reasons: string[] = [];
  let finalScore = score;

  if (score < SUBJECT_THRESHOLD) return null;

  if (score >= 0.92) {
    reasons.push(a.kind === "company" ? "Ragione sociale quasi identica" : "Nome molto simile");
  } else {
    reasons.push("Soggetto interno simile");
  }

  if (sameCounterparty) {
    finalScore = Math.max(finalScore, 0.9);
    reasons.push("Stessa controparte composta");
  } else if (score >= 0.82) {
    reasons.push("Soggetto simile in controparti diverse");
  }

  if (reasons.length === 0) return null;
  return buildCandidate({
    entityType: "counterparty_subject",
    left: counterpartySubjectRecord(a),
    right: counterpartySubjectRecord(b),
    score: finalScore,
    reasons,
  });
}

type CrossEntitySourceType = "principal" | "client" | "counterparty" | "counterparty_subject";

type CrossEntityDuplicateRow = {
  id: string;
  sourceType: CrossEntitySourceType;
  sourceLabel: string;
  publicCode?: string | null;
  href: string;
  kind: "individual" | "company";
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  email?: string | null;
  taxCode?: string | null;
  vatNumber?: string | null;
  pec?: string | null;
  parentId?: string | null;
  parentLabel?: string | null;
};

function scoreCrossEntityCandidates(input: DuplicateScanInput) {
  const rows = [
    ...input.principals.map(principalCrossEntityRow),
    ...input.clients.map(clientCrossEntityRow),
    ...input.counterparties.flatMap((row) => {
      const candidate = counterpartyCrossEntityRow(row);
      return candidate ? [candidate] : [];
    }),
    ...(input.counterpartySubjects ?? []).map(subjectCrossEntityRow),
  ];

  return pairwise(rows, scoreCrossEntityPair);
}

function scoreCrossEntityPair(a: CrossEntityDuplicateRow, b: CrossEntityDuplicateRow) {
  if (a.sourceType === b.sourceType) return null;
  if (
    (a.sourceType === "counterparty" &&
      b.sourceType === "counterparty_subject" &&
      b.parentId === a.id) ||
    (b.sourceType === "counterparty" &&
      a.sourceType === "counterparty_subject" &&
      a.parentId === b.id)
  ) {
    return null;
  }

  const nameScore =
    a.kind === "company" && b.kind === "company"
      ? businessNameSimilarity(a.businessName, b.businessName)
      : a.kind === "individual" && b.kind === "individual"
        ? personNameSimilarity(
            { firstName: a.firstName, lastName: a.lastName },
            { firstName: b.firstName, lastName: b.lastName },
          )
        : 0;

  const reasons: string[] = [];
  let score = nameScore;
  if (nameScore >= 0.94) {
    reasons.push(`Nome coincidente tra ${a.sourceLabel} e ${b.sourceLabel}`);
  } else if (nameScore >= CROSS_TYPE_THRESHOLD) {
    reasons.push(`Nome molto simile tra ${a.sourceLabel} e ${b.sourceLabel}`);
  }

  if (sameFilled(a.vatNumber, b.vatNumber)) {
    score = Math.max(score, 0.98);
    reasons.push("Partita IVA coincidente");
  }
  if (sameFilled(a.taxCode, b.taxCode)) {
    score = Math.max(score, 0.96);
    reasons.push("Codice fiscale coincidente");
  }
  if (sameFilled(a.pec, b.pec) || sameFilled(a.email, b.email)) {
    score = Math.max(score, 0.94);
    reasons.push("Contatto coincidente");
  }

  if (score < CROSS_TYPE_THRESHOLD || reasons.length === 0) return null;
  return buildCandidate({
    entityType: "cross_entity",
    left: crossEntityRecord(a),
    right: crossEntityRecord(b),
    score,
    reasons,
  });
}

function attachReview(
  candidate: DuplicateCandidate,
  reviewsByPair: Map<string, DuplicateReviewRow>,
  now: Date,
) {
  const review = reviewsByPair.get(
    duplicatePairKey(candidate.entityType, candidate.left.id, candidate.right.id),
  );
  if (!review) return candidate;
  const snoozeExpired = isSnoozeExpired(review.snoozed_until, now);
  const status = snoozeExpired ? "open" : review.status;
  return {
    ...candidate,
    reviewId: review.id,
    status,
    detectedAt: review.detected_at ?? null,
    resolvedAt: review.resolved_at ?? null,
    snoozedUntil: status === "snoozed" ? (review.snoozed_until ?? null) : null,
  };
}

function isSnoozeExpired(snoozedUntil: string | null | undefined, now: Date) {
  if (!snoozedUntil) return false;
  const until = new Date(snoozedUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() <= now.getTime();
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
    snoozedUntil: review.snoozed_until ?? null,
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

function activityRecord(row: ActivityDuplicateRow): DuplicateRecord {
  const displayStatus = caseActivityDisplayStatus({
    status: row.status,
    invoice_id: row.invoice_id,
  });
  return {
    id: row.id,
    label: row.snapshot_price_name || row.description || "Attività",
    subtitle: [
      row.casePracticeNumber ? `Pratica ${row.casePracticeNumber}` : null,
      formatDate(row.activity_date),
      formatCurrency(toNumber(row.amount)),
    ]
      .filter(Boolean)
      .join(" · "),
    href: "/attivita",
    fields: {
      Pratica: row.casePracticeNumber ? `Pratica ${row.casePracticeNumber}` : null,
      Committente: row.principalName,
      Cliente: row.clientName,
      Controparte: row.counterpartyName,
      Data: formatDate(row.activity_date),
      Tipo: priceItemKindLabels[row.kind] ?? row.kind,
      Voce: row.snapshot_price_name,
      Descrizione: row.description,
      Quantità: toNumber(row.quantity),
      "Prezzo unitario": formatCurrency(toNumber(row.unit_price)),
      Importo: formatCurrency(toNumber(row.amount)),
      Stato: caseActivityDisplayStatusLabels[displayStatus] ?? displayStatus,
    },
  };
}

function counterpartySubjectRecord(row: CounterpartySubjectDuplicateRow): DuplicateRecord {
  return {
    id: row.id,
    label: counterpartySubjectLabel(row),
    subtitle: row.counterpartyName ? `In ${row.counterpartyName}` : null,
    href: `/controparti/${row.counterpartyPublicCode || row.counterparty_id}`,
    fields: {
      "Tipo record": "Soggetto interno",
      "Controparte composta": row.counterpartyName,
      Tipo: row.kind === "company" ? "Società" : "Persona fisica",
      Nome: [row.first_name, row.last_name].filter(Boolean).join(" "),
      "Ragione sociale": row.business_name,
      Posizione: row.position,
      Note: row.notes,
    },
  };
}

function principalCrossEntityRow(row: PrincipalDuplicateRow): CrossEntityDuplicateRow {
  return {
    id: row.id,
    sourceType: "principal",
    sourceLabel: "Committente",
    publicCode: row.public_code,
    href: `/committenti/${row.public_code || row.id}`,
    kind: "company",
    businessName: row.business_name,
    email: row.email,
    taxCode: row.tax_code,
    vatNumber: row.vat_number,
    pec: row.pec,
  };
}

function clientCrossEntityRow(row: ClientDuplicateRow): CrossEntityDuplicateRow {
  return {
    id: row.id,
    sourceType: "client",
    sourceLabel: "Cliente",
    publicCode: row.public_code,
    href: `/clienti/${row.public_code || row.id}`,
    kind: row.kind === "company" ? "company" : "individual",
    firstName: row.first_name,
    lastName: row.last_name,
    businessName: row.business_name,
    email: row.email,
  };
}

function counterpartyCrossEntityRow(row: CounterpartyDuplicateRow): CrossEntityDuplicateRow | null {
  if (row.kind === "group") return null;
  return {
    id: row.id,
    sourceType: "counterparty",
    sourceLabel: "Controparte",
    publicCode: row.public_code,
    href: `/controparti/${row.public_code || row.id}`,
    kind: row.kind === "company" ? "company" : "individual",
    firstName: row.first_name,
    lastName: row.last_name,
    businessName: row.business_name,
  };
}

function subjectCrossEntityRow(row: CounterpartySubjectDuplicateRow): CrossEntityDuplicateRow {
  return {
    id: row.id,
    sourceType: "counterparty_subject",
    sourceLabel: "Soggetto interno",
    href: `/controparti/${row.counterpartyPublicCode || row.counterparty_id}`,
    kind: row.kind === "company" ? "company" : "individual",
    firstName: row.first_name,
    lastName: row.last_name,
    businessName: row.business_name,
    parentId: row.counterparty_id,
    parentLabel: row.counterpartyName,
  };
}

function crossEntityRecord(row: CrossEntityDuplicateRow): DuplicateRecord {
  return {
    id: row.id,
    publicCode: row.publicCode,
    label: crossEntityLabel(row),
    subtitle: row.parentLabel ?? row.sourceLabel,
    href: row.href,
    fields: {
      "Tipo record": row.sourceLabel,
      Tipo: row.kind === "company" ? "Società" : "Persona fisica",
      Nome: [row.firstName, row.lastName].filter(Boolean).join(" "),
      "Ragione sociale": row.businessName,
      "Controparte composta": row.parentLabel,
      Email: row.email,
      PEC: row.pec,
      "P.IVA": row.vatNumber,
      "Codice fiscale": row.taxCode,
    },
  };
}

function counterpartySubjectLabel(row: CounterpartySubjectDuplicateRow) {
  return row.kind === "company"
    ? row.business_name || "Soggetto società"
    : [row.first_name, row.last_name].filter(Boolean).join(" ") || "Soggetto persona";
}

function crossEntityLabel(row: CrossEntityDuplicateRow) {
  return row.kind === "company"
    ? row.businessName || row.sourceLabel
    : [row.firstName, row.lastName].filter(Boolean).join(" ") || row.sourceLabel;
}

function sameFilled(a: string | null | undefined, b: string | null | undefined) {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function sameNumber(a: number | string | null | undefined, b: number | string | null | undefined) {
  const left = toNumber(a);
  const right = toNumber(b);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.005;
}

function toNumber(value: number | string | null | undefined) {
  const numberValue = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
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
  if (!canMergeDuplicateEntity(entityType)) {
    return `Verifica ${displayDuplicateEntity(entityType).toLowerCase()}`;
  }
  return `Unione ${displayDuplicateEntity(entityType).toLowerCase()}`;
}
