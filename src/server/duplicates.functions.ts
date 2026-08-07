import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  canMergeDuplicateEntity,
  DUPLICATE_SNOOZE_OPTIONS,
  type DuplicateEntityType,
  type DuplicateSnoozeInterval,
} from "@/lib/duplicate-matching";
import {
  attachPersistedReviews,
  persistOpenCandidates,
  saveDuplicateDecision,
} from "@/server/duplicates-decision.server";
import { loadDuplicateScanData } from "@/server/duplicates-load.server";
import { scanDuplicateCandidates, scanDuplicateDraft } from "@/server/duplicates.logic";
import { mergeRecords } from "@/server/duplicates-merge.server";

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
  snoozeInterval?: DuplicateSnoozeInterval | null;
  keepRecordId?: string | null;
};

export type DuplicateSummaryResult = {
  openCount: number;
  highConfidenceCount: number;
  snoozedCount: number;
  resolvedCount: number;
};

export const scanDuplicateCandidatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scan = scanDuplicateCandidates(
      await loadDuplicateScanData(context.supabase, context.userId),
    );
    const inserted = await persistOpenCandidates(
      context.supabase,
      context.userId,
      scan.openCandidates,
    );
    return {
      openCandidates: attachPersistedReviews(scan.openCandidates, inserted),
      resolvedCandidates: scan.resolvedCandidates,
    };
  });

export const getDuplicateSummaryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DuplicateSummaryResult> => {
    const scan = scanDuplicateCandidates(
      await loadDuplicateScanData(context.supabase, context.userId),
    );
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
  .validator(validateFindDuplicateDraftInput)
  .handler(async ({ data, context }) => {
    const scanData = await loadDuplicateScanData(context.supabase, context.userId, "draft");
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
  .validator(validateResolveDuplicateInput)
  .handler(async ({ data, context }) => {
    let keptRecordId: string | null = null;
    let mergedRecordId: string | null = null;

    if (data.action === "merge") {
      if (!data.keepRecordId) throw new Error("Scegli il record da mantenere");
      if (![data.leftRecordId, data.rightRecordId].includes(data.keepRecordId)) {
        throw new Error("Record da mantenere non valido");
      }
      keptRecordId = data.keepRecordId;
      mergedRecordId = keptRecordId === data.leftRecordId ? data.rightRecordId : data.leftRecordId;
      await mergeRecords(
        supabaseAdmin,
        context.userId,
        data.entityType,
        keptRecordId,
        mergedRecordId,
      );
    }

    return saveDuplicateDecision({
      client: context.supabase,
      userId: context.userId,
      entityType: data.entityType,
      leftRecordId: data.leftRecordId,
      rightRecordId: data.rightRecordId,
      action: data.action,
      snoozeInterval: data.snoozeInterval,
      keptRecordId,
      mergedRecordId,
    });
  });

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
  if (!input || typeof input !== "object") {
    throw new Error("Input risoluzione duplicato non valido");
  }
  if (
    ![
      "principal",
      "client",
      "counterparty",
      "case",
      "activity",
      "counterparty_subject",
      "cross_entity",
    ].includes(input.entityType)
  ) {
    throw new Error("Tipo duplicato non valido");
  }
  if (!["snooze", "dismiss", "merge"].includes(input.action)) {
    throw new Error("Azione duplicato non valida");
  }
  if (
    input.action === "snooze" &&
    input.snoozeInterval &&
    !DUPLICATE_SNOOZE_OPTIONS.some((option) => option.value === input.snoozeInterval)
  ) {
    throw new Error("Intervallo promemoria non valido");
  }
  if (input.action === "merge" && !canMergeDuplicateEntity(input.entityType)) {
    throw new Error("Questo tipo di sospetto non supporta l'unione automatica");
  }
  if (!input.leftRecordId || !input.rightRecordId) {
    throw new Error("Coppia duplicato non valida");
  }
  return input;
}
