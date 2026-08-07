import {
  duplicatePairKey,
  type DuplicateCandidate,
  type DuplicateEntityType,
  type DuplicateReviewStatus,
  type DuplicateSnoozeInterval,
} from "@/lib/duplicate-matching";
import { asDuplicateDb } from "@/server/duplicates-db.server";
import { reviewInsertFromCandidate, type DuplicateReviewRow } from "@/server/duplicates.logic";

export async function persistOpenCandidates(
  client: unknown,
  userId: string,
  candidates: DuplicateCandidate[],
) {
  const rows = candidates.flatMap((candidate) =>
    candidate.reviewId ? [] : [reviewInsertFromCandidate(userId, candidate)],
  );
  if (rows.length === 0) return [];

  const { data, error } = await asDuplicateDb(client)
    .from<DuplicateReviewRow[]>("duplicate_reviews")
    .upsert(rows, {
      onConflict: "user_id,entity_type,left_record_id,right_record_id",
      ignoreDuplicates: true,
    })
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export function attachPersistedReviews(
  candidates: DuplicateCandidate[],
  reviews: DuplicateReviewRow[],
) {
  const reviewsByPair = new Map(
    reviews.map((review) => [
      duplicatePairKey(review.entity_type, review.left_record_id, review.right_record_id),
      review,
    ]),
  );
  return candidates.map((candidate) => {
    if (candidate.reviewId) return candidate;
    const review = reviewsByPair.get(
      duplicatePairKey(candidate.entityType, candidate.left.id, candidate.right.id),
    );
    return review
      ? { ...candidate, reviewId: review.id, detectedAt: review.detected_at }
      : candidate;
  });
}

export async function saveDuplicateDecision({
  client,
  userId,
  entityType,
  leftRecordId,
  rightRecordId,
  action,
  snoozeInterval,
  keptRecordId,
  mergedRecordId,
}: {
  client: unknown;
  userId: string;
  entityType: DuplicateEntityType;
  leftRecordId: string;
  rightRecordId: string;
  action: "snooze" | "dismiss" | "merge";
  snoozeInterval?: DuplicateSnoozeInterval | null;
  keptRecordId: string | null;
  mergedRecordId: string | null;
}) {
  const status = statusForAction(action);
  const snoozedUntil = action === "snooze" ? calculateSnoozedUntil(snoozeInterval ?? "24h") : null;
  const [leftId, rightId] =
    leftRecordId < rightRecordId ? [leftRecordId, rightRecordId] : [rightRecordId, leftRecordId];

  const { data: review, error } = await asDuplicateDb(client)
    .from<DuplicateReviewRow>("duplicate_reviews")
    .update({
      status,
      kept_record_id: keptRecordId,
      merged_record_id: mergedRecordId,
      snoozed_until: snoozedUntil,
      resolved_at: status === "snoozed" ? null : new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("left_record_id", leftId)
    .eq("right_record_id", rightId)
    .select("*")
    .single();
  if (error) throw error;
  return review;
}

function statusForAction(action: "snooze" | "dismiss" | "merge"): DuplicateReviewStatus {
  if (action === "dismiss") return "dismissed";
  if (action === "merge") return "merged";
  return "snoozed";
}

function calculateSnoozedUntil(interval: DuplicateSnoozeInterval) {
  const date = new Date();
  if (interval === "1h") date.setHours(date.getHours() + 1);
  if (interval === "24h") date.setDate(date.getDate() + 1);
  if (interval === "1w") date.setDate(date.getDate() + 7);
  if (interval === "1m") date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}
