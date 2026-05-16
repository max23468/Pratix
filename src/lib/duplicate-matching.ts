export type DuplicateEntityType = "principal" | "client" | "counterparty" | "case";

export type DuplicateConfidence = "high" | "medium" | "low";

export type DuplicateReviewStatus = "open" | "snoozed" | "dismissed" | "merged";

export type DuplicateRecord = {
  id: string;
  publicCode?: string | null;
  label: string;
  subtitle?: string | null;
  href?: string;
  fields?: Record<string, string | number | null | undefined>;
  links?: Record<string, number>;
};

export type DuplicateCandidate = {
  reviewId?: string | null;
  entityType: DuplicateEntityType;
  left: DuplicateRecord;
  right: DuplicateRecord;
  score: number;
  confidence: DuplicateConfidence;
  reasons: string[];
  status: DuplicateReviewStatus;
  detectedAt?: string | null;
  resolvedAt?: string | null;
};

type NameParts = {
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
};

const LEGAL_FORMS = new Set([
  "srl",
  "spa",
  "sas",
  "snc",
  "societa",
  "soc",
  "cooperativa",
  "coop",
  "impresa",
  "azienda",
  "gruppo",
]);

const WEAK_WORDS = new Set(["di", "del", "della", "dei", "degli", "le", "la", "il", "lo", "e"]);

export function normalizeDuplicateText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\.?\b/g, " srl ")
    .replace(/\bs\s*\.?\s*p\s*\.?\s*a\.?\b/g, " spa ")
    .replace(/\bs\s*\.?\s*a\s*\.?\s*s\.?\b/g, " sas ")
    .replace(/\bs\s*\.?\s*n\s*\.?\s*c\.?\b/g, " snc ")
    .replace(/[''`]/g, " ")
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedTokens(value: string | null | undefined, options?: { legal?: boolean }) {
  const tokens = normalizeDuplicateText(value).split(" ").filter(Boolean);
  return tokens.filter((token) => {
    if (WEAK_WORDS.has(token)) return false;
    if (options?.legal && LEGAL_FORMS.has(token)) return false;
    return true;
  });
}

export function normalizeBusinessName(value: string | null | undefined) {
  return normalizedTokens(value, { legal: true }).join(" ");
}

function personLabel(parts: NameParts) {
  return [parts.firstName, parts.lastName].filter(Boolean).join(" ").trim();
}

export function displayDuplicateEntity(entityType: DuplicateEntityType) {
  const labels: Record<DuplicateEntityType, string> = {
    principal: "Committente",
    client: "Cliente",
    counterparty: "Controparte",
    case: "Pratica",
  };
  return labels[entityType];
}

export function duplicateEntityPath(entityType: DuplicateEntityType, record: DuplicateRecord) {
  const ref = record.publicCode || record.id;
  const bases: Record<DuplicateEntityType, string> = {
    principal: "/committenti",
    client: "/clienti",
    counterparty: "/controparti",
    case: "/pratiche",
  };
  return `${bases[entityType]}/${ref}`;
}

export function canonicalPair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

export function duplicatePairKey(entityType: DuplicateEntityType, a: string, b: string) {
  const [left, right] = canonicalPair(a, b);
  return `${entityType}:${left}:${right}`;
}

export function candidateConfidence(score: number): DuplicateConfidence {
  if (score >= 0.88) return "high";
  if (score >= 0.74) return "medium";
  return "low";
}

export function shouldWarnBeforeCreate(candidate: Pick<DuplicateCandidate, "confidence">) {
  return candidate.confidence === "high" || candidate.confidence === "medium";
}

export function textSimilarity(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeDuplicateText(a);
  const right = normalizeDuplicateText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const distance = levenshtein(left, right);
  const editScore = 1 - distance / Math.max(left.length, right.length);
  const tokenScore = tokenJaccard(left, right);
  return Math.max(0, Math.min(1, editScore * 0.65 + tokenScore * 0.35));
}

export function businessNameSimilarity(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeBusinessName(a);
  const right = normalizeBusinessName(b);
  return textSimilarity(left, right);
}

export function personNameSimilarity(a: NameParts, b: NameParts) {
  const direct = textSimilarity(personLabel(a), personLabel(b));
  const inverted = textSimilarity(
    [a.lastName, a.firstName].filter(Boolean).join(" "),
    personLabel(b),
  );
  return Math.max(direct, inverted);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

export function buildCandidate(input: {
  entityType: DuplicateEntityType;
  left: DuplicateRecord;
  right: DuplicateRecord;
  score: number;
  reasons: string[];
  status?: DuplicateReviewStatus;
  reviewId?: string | null;
  detectedAt?: string | null;
  resolvedAt?: string | null;
}): DuplicateCandidate {
  const score = clampScore(input.score);
  return {
    entityType: input.entityType,
    left: {
      ...input.left,
      href: input.left.href ?? duplicateEntityPath(input.entityType, input.left),
    },
    right: {
      ...input.right,
      href: input.right.href ?? duplicateEntityPath(input.entityType, input.right),
    },
    score,
    confidence: candidateConfidence(score),
    reasons: input.reasons,
    status: input.status ?? "open",
    reviewId: input.reviewId ?? null,
    detectedAt: input.detectedAt ?? null,
    resolvedAt: input.resolvedAt ?? null,
  };
}

function tokenJaccard(a: string, b: string) {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function levenshtein(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}
