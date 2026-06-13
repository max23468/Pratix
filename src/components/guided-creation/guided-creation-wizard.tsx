import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, CheckCircle2, FileInput } from "lucide-react";
import { toast } from "sonner";
import { ActivitiesStep } from "./activities-step";
import { initialDraft, makeActivity } from "./draft";
import { buildNormalizedGuidedCreation } from "./normalization";
import { PracticeStep } from "./practice-step";
import { ReviewStep } from "./review-step";
import { SubjectsStep } from "./subjects-step";
import type {
  ActivityDraft,
  ClientRow,
  CounterpartyRow,
  GuidedCreationDraft,
  NormalizedGuidedCreation,
  PriceBookRow,
  PriceItemRow,
  PriceOption,
  PrincipalRow,
  StagedGuidedCreation,
} from "./types";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { compareClients, compareCounterparties } from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import { getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { buildActivityAttachmentStoragePath, PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import { useSubmitLock } from "@/lib/submit-lock";
import {
  recordGuidedCreationActivityAttachmentFn,
  type RecordGuidedCreationActivityAttachmentInput,
} from "@/server/guided-creation.functions";

const guidedCreationSteps = ["Soggetti", "Pratica", "Attività", "Riepilogo"];

export function GuidedCreationWizard({ onCreated }: { onCreated: (caseId: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const recordGuidedCreationActivityAttachment = useServerFn(
    recordGuidedCreationActivityAttachmentFn,
  );
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<GuidedCreationDraft>(() => initialDraft());
  const [staged, setStaged] = useState<StagedGuidedCreation | null>(null);
  const prepareLock = useSubmitLock();
  const confirmLock = useSubmitLock();

  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "guided-creation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name, fees_enabled, expense_reimbursements_enabled")
        .is("archived_at", null)
        .order("business_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrincipalRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "guided-creation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, kind, first_name, last_name, business_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ClientRow[]).slice().sort(compareClients);
    },
  });

  const { data: counterparties = [] } = useQuery({
    queryKey: ["counterparties", "guided-creation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, kind, first_name, last_name, business_name");
      if (error) throw error;
      return ((data ?? []) as CounterpartyRow[]).slice().sort(compareCounterparties);
    },
  });

  const principalId = draft.principalMode === "existing" ? draft.principalId : "";

  const { data: priceBooks = [] } = useQuery({
    queryKey: ["price-books", "guided-creation", principalId],
    enabled: Boolean(principalId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_books")
        .select("id, principal_id, year, status, fees_enabled, expense_reimbursements_enabled")
        .eq("principal_id", principalId)
        .in("status", ["active", "draft"])
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriceBookRow[];
    },
  });

  const priceBookIds = useMemo(() => priceBooks.map((book) => book.id), [priceBooks]);

  const { data: priceItems = [] } = useQuery({
    queryKey: ["price-items", "guided-creation", priceBookIds],
    enabled: priceBookIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_items")
        .select(
          "id, price_book_id, kind, code, name, invoice_description, unit_price, requires_hearing_dates",
        )
        .in("price_book_id", priceBookIds)
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PriceItemRow[];
    },
  });

  const priceOptions = useMemo(() => {
    const booksById = new Map(priceBooks.map((book) => [book.id, book]));
    return priceItems
      .map((item) => {
        const book = booksById.get(item.price_book_id);
        if (!book) return null;
        return {
          ...item,
          principal_id: book.principal_id,
          price_book_year: book.year,
          price_book_status: book.status,
          book_fees_enabled: book.fees_enabled,
          book_expense_reimbursements_enabled: book.expense_reimbursements_enabled,
        };
      })
      .filter((item): item is PriceOption => Boolean(item))
      .filter((item) =>
        item.kind === "fee" ? item.book_fees_enabled : item.book_expense_reimbursements_enabled,
      );
  }, [priceBooks, priceItems]);

  const updateDraft = <K extends keyof GuidedCreationDraft>(
    key: K,
    value: GuidedCreationDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setStaged(null);
  };

  const updateActivity = <K extends keyof ActivityDraft>(
    localId: string,
    key: K,
    value: ActivityDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      activities: current.activities.map((activity) =>
        activity.localId === localId ? { ...activity, [key]: value } : activity,
      ),
    }));
    setStaged(null);
  };

  const addActivity = () => {
    setDraft((current) => ({ ...current, activities: [...current.activities, makeActivity()] }));
    setStaged(null);
  };

  const removeActivity = (localId: string) => {
    setDraft((current) => ({
      ...current,
      activities: current.activities.filter((activity) => activity.localId !== localId),
    }));
    setStaged(null);
  };

  const prepared = useMemo(
    () => buildNormalizedGuidedCreation(draft, principals, clients, counterparties, priceOptions),
    [clients, counterparties, draft, priceOptions, principals],
  );

  const prepareMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (prepared.errors.length > 0) throw new Error(prepared.errors[0]);

      const { data: importRow, error: importError } = await supabase
        .from("imports")
        .insert({
          user_id: user.id,
          mode: "manual",
          status: "validated",
          total_rows: 1,
          valid_rows: 1,
          error_rows: 0,
          notes: "Pratica preparata dalla procedura guidata manuale.",
        })
        .select("id")
        .single();
      if (importError) throw importError;

      const { data: row, error: rowError } = await supabase
        .from("import_rows")
        .insert({
          user_id: user.id,
          import_id: importRow.id,
          row_number: 1,
          status: prepared.warnings.length > 0 ? "warning" : "valid",
          raw_data: serializeGuidedCreationDraft(draft) as unknown as Json,
          normalized_data: prepared.normalized as unknown as Json,
          warning_messages: prepared.warnings,
        })
        .select("id")
        .single();
      if (rowError) throw rowError;

      return { importId: importRow.id, rowId: row.id };
    },
    onSuccess: (row) => {
      setStaged({
        ...row,
        status: prepared.warnings.length > 0 ? "warning" : "valid",
        normalized: prepared.normalized,
        warnings: prepared.warnings,
      });
      setStep(3);
      toast.success("Anteprima pronta");
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: prepareLock.release,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!staged) throw new Error("Prepara prima l'anteprima");
      if (staged.status === "imported") throw new Error("Questa pratica è già stata creata.");
      const caseId = await confirmGuidedCreationRow(staged.rowId);
      const attachmentErrors = await uploadGuidedCreationActivityAttachments(
        user.id,
        prepared.normalized.activities,
        draft.activities,
        async (data) =>
          readServerResult(
            await recordGuidedCreationActivityAttachment({
              data,
              headers: await getAuthHeaders(),
            }),
          ),
      );
      return { caseId, attachmentErrors };
    },
    onSuccess: async ({ caseId, attachmentErrors }) => {
      if (attachmentErrors.length > 0) {
        toast.error(`Pratica creata, ${attachmentErrors.length} allegati non caricati.`);
      } else {
        toast.success("Pratica creata");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["imports"] }),
        qc.invalidateQueries({ queryKey: ["cases"] }),
        qc.invalidateQueries({ queryKey: ["activities"] }),
        qc.invalidateQueries({ queryKey: ["principals"] }),
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["counterparties"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setStaged((current) => (current ? { ...current, status: "imported" } : current));
      onCreated(caseId);
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: confirmLock.release,
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) setStep((current) => current + 1);
        else if (!staged) {
          if (prepareLock.acquire()) prepareMutation.mutate();
        } else if (confirmLock.acquire()) {
          confirmMutation.mutate();
        }
      }}
      className="space-y-4"
    >
      <div className="grid gap-2 md:grid-cols-4">
        {guidedCreationSteps.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`rounded-md border border-border px-3 py-2 text-left text-sm ${
              step === index ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => setStep(index)}
          >
            <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border border-border text-xs">
              {index + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <SubjectsStep
          draft={draft}
          principals={principals}
          clients={clients}
          counterparties={counterparties}
          updateDraft={updateDraft}
        />
      ) : null}

      {step === 1 ? <PracticeStep draft={draft} updateDraft={updateDraft} /> : null}

      {step === 2 ? (
        <ActivitiesStep
          draft={draft}
          priceOptions={priceOptions}
          updateActivity={updateActivity}
          addActivity={addActivity}
          removeActivity={removeActivity}
        />
      ) : null}

      {step === 3 ? (
        <ReviewStep prepared={prepared} staged={staged} isPreparing={prepareMutation.isPending} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || prepareMutation.isPending || confirmMutation.isPending}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          <ArrowLeft className="mr-1 size-4" /> Indietro
        </Button>
        <div className="flex gap-2">
          {step < 3 ? (
            <Button type="submit">
              Avanti <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : staged ? (
            <Button
              type="submit"
              disabled={
                confirmMutation.isPending ||
                prepared.errors.length > 0 ||
                staged.status === "imported"
              }
            >
              <CheckCircle2 className="mr-1 size-4" />
              {staged.status === "imported"
                ? "Creazione completata"
                : confirmMutation.isPending
                  ? "Conferma in corso…"
                  : "Conferma creazione"}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={prepareMutation.isPending || prepared.errors.length > 0}
            >
              <FileInput className="mr-1 size-4" />
              {prepareMutation.isPending ? "Preparazione…" : "Prepara anteprima"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

async function confirmGuidedCreationRow(rowId: string) {
  const { data, error } = await supabase.rpc("apply_import_row", { p_import_row_id: rowId });
  if (error) throw error;
  if (!data) throw new Error("Creazione non completata.");
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, public_code")
    .eq("id", data)
    .single();
  if (caseError) throw caseError;
  return routeRef(caseRow);
}

function serializeGuidedCreationDraft(draft: GuidedCreationDraft) {
  return {
    ...draft,
    activities: draft.activities.map((activity) => ({
      ...activity,
      attachmentFile: activity.attachmentFile
        ? {
            name: activity.attachmentFile.name,
            type: activity.attachmentFile.type,
            size: activity.attachmentFile.size,
          }
        : null,
    })),
  };
}

async function uploadGuidedCreationActivityAttachments(
  userId: string,
  normalizedActivities: NormalizedGuidedCreation["activities"],
  draftActivities: ActivityDraft[],
  recordAttachment: (data: RecordGuidedCreationActivityAttachmentInput) => Promise<unknown>,
) {
  const errors: string[] = [];
  const activitiesById = new Map(normalizedActivities.map((activity) => [activity.id, activity]));

  for (const draftActivity of draftActivities) {
    const file = draftActivity.attachmentFile;
    const normalizedActivity = activitiesById.get(draftActivity.activityId);
    if (!file || !normalizedActivity) continue;

    try {
      const storagePath = buildActivityAttachmentStoragePath(
        userId,
        normalizedActivity.id,
        `${Date.now()}-${file.name}`,
      );
      const { error: uploadError } = await supabase.storage
        .from(PRATIX_DOCUMENTS_BUCKET)
        .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) throw uploadError;

      await recordAttachment({
        activityId: normalizedActivity.id,
        storagePath,
        originalFileName: file.name,
        displayName: draftActivity.attachmentName.trim() || file.name,
        documentType: draftActivity.attachmentType.trim() || null,
        mimeType: file.type || null,
        sizeBytes: file.size,
        previewAvailable: file.type.startsWith("image/") || file.type === "application/pdf",
        notes: draftActivity.attachmentNotes.trim() || null,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Errore allegato");
    }
  }

  return errors;
}
