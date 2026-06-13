import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RecordGuidedCreationActivityAttachmentInput = {
  activityId: string;
  storagePath: string;
  originalFileName: string;
  displayName: string;
  documentType: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  previewAvailable: boolean;
  notes: string | null;
};

export const recordGuidedCreationActivityAttachmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateRecordGuidedCreationActivityAttachmentInput)
  .handler(async ({ data, context }) => {
    const expectedPrefix = `${context.userId}/activities/${data.activityId}/`;
    if (!data.storagePath.startsWith(expectedPrefix)) {
      throw new Error("Percorso allegato non valido");
    }

    const { error } = await context.supabase.from("activity_attachments").insert({
      user_id: context.userId,
      activity_id: data.activityId,
      storage_path: data.storagePath,
      original_file_name: data.originalFileName,
      display_name: data.displayName,
      document_type: data.documentType,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      preview_available: data.previewAvailable,
      notes: data.notes,
    });
    if (error) throw error;

    return { ok: true };
  });

function validateRecordGuidedCreationActivityAttachmentInput(
  input: RecordGuidedCreationActivityAttachmentInput,
) {
  if (!input || typeof input !== "object") throw new Error("Allegato non valido");
  if (!input.activityId) throw new Error("Attività allegato non valida");
  if (!input.storagePath) throw new Error("Percorso allegato non valido");
  if (!input.originalFileName) throw new Error("Nome file allegato non valido");
  if (!input.displayName?.trim()) throw new Error("Nome allegato non valido");
  if (input.documentType != null && typeof input.documentType !== "string") {
    throw new Error("Tipo documento non valido");
  }
  if (input.mimeType != null && typeof input.mimeType !== "string") {
    throw new Error("Tipo file non valido");
  }
  if (input.sizeBytes != null && (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0)) {
    throw new Error("Dimensione allegato non valida");
  }
  if (typeof input.previewAvailable !== "boolean") throw new Error("Anteprima allegato non valida");
  if (input.notes != null && typeof input.notes !== "string")
    throw new Error("Note allegato non valide");
  return input;
}
