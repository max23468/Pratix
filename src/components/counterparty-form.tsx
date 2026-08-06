import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DuplicateWarningPanel } from "@/components/duplicate-warning-panel";
import { CounterpartySubjectsEditor } from "@/components/counterparty-subjects-editor";
import {
  emptySubject,
  type SubjectDraft,
  type SubjectRow,
} from "@/components/counterparty-subjects";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { supabase } from "@/integrations/supabase/client";
import { withTriggerGeneratedCode } from "@/integrations/supabase/insert-helpers";
import { useAuth } from "@/lib/auth-context";
import { counterpartyKindLabels } from "@/lib/labels";
import type { DuplicateCandidate } from "@/lib/duplicate-matching";
import { routeRef } from "@/lib/public-route-code";
import { canUseAuthHeaders, getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { useSubmitLock } from "@/lib/submit-lock";
import { findDuplicateCandidatesFn } from "@/server/duplicates.functions";

type CounterpartyKind = "individual" | "company" | "group";

type CounterpartyRow = {
  id?: string;
  public_code?: string | null;
  kind: CounterpartyKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
};

const emptyCounterparty: CounterpartyRow = {
  kind: "company",
  first_name: "",
  last_name: "",
  business_name: "",
  notes: "",
};

type Props = {
  initial?: Partial<CounterpartyRow> & { id?: string };
  initialSubjects?: SubjectRow[];
  onSaved: (id: string) => void;
  onCancel: () => void;
};

const emptySubjects: SubjectRow[] = [];

export function CounterpartyForm({
  initial,
  initialSubjects = emptySubjects,
  onSaved,
  onCancel,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<CounterpartyRow>({
    ...emptyCounterparty,
    ...(initial ?? {}),
  });
  const [subjects, setSubjects] = useState<SubjectDraft[]>(
    initialSubjects.length > 0
      ? initialSubjects.map((subject) => ({
          ...subject,
          clientKey: subject.id ?? crypto.randomUUID(),
        }))
      : [emptySubject(0)],
  );
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const duplicateOverride = useRef(false);
  const isEdit = Boolean(initial?.id);
  const { finishSave, formRef, guardDialog, markDirty } = useUnsavedChangesGuard();
  const saveLock = useSubmitLock();
  const findDuplicates = useServerFn(findDuplicateCandidatesFn);

  const upd = <K extends keyof CounterpartyRow>(key: K, value: CounterpartyRow[K]) => {
    markDirty();
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateSubject = <K extends keyof SubjectRow>(
    index: number,
    key: K,
    value: SubjectRow[K],
  ) => {
    markDirty();
    setSubjects((current) =>
      current.map((subject, currentIndex) =>
        currentIndex === index ? { ...subject, [key]: value } : subject,
      ),
    );
  };

  const normalizedSubjects = () =>
    subjects.flatMap(({ clientKey: _clientKey, ...subject }, position) => {
      const normalized = { ...subject, position };
      const hasName =
        normalized.kind === "company"
          ? normalized.business_name?.trim()
          : normalized.first_name?.trim() || normalized.last_name?.trim();
      return hasName ? [normalized] : [];
    });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");

      if (form.kind === "individual" && !form.first_name?.trim() && !form.last_name?.trim()) {
        throw new Error("Inserisci nome e cognome");
      }
      if (form.kind !== "individual" && !form.business_name?.trim()) {
        throw new Error("Inserisci la ragione sociale o il nome del gruppo");
      }

      const payload = {
        user_id: user.id,
        kind: form.kind,
        first_name: form.kind === "individual" ? form.first_name?.trim() || null : null,
        last_name: form.kind === "individual" ? form.last_name?.trim() || null : null,
        business_name: form.kind !== "individual" ? form.business_name?.trim() || null : null,
        notes: form.notes?.trim() || null,
      };

      const counterpartyId =
        isEdit && initial?.id
          ? await updateCounterparty(initial.id, payload)
          : await createCounterparty(payload);

      if (form.kind === "group") {
        await syncSubjects(counterpartyId.id, user.id, normalizedSubjects());
      } else {
        await deleteSubjects(counterpartyId.id);
      }

      return counterpartyId;
    },
    onSuccess: (counterparty) => {
      toast.success(isEdit ? "Controparte aggiornata" : "Controparte creata");
      qc.invalidateQueries({ queryKey: ["counterparties"] });
      qc.invalidateQueries({ queryKey: ["counterparty", counterparty.id] });
      if (finishSave()) return;
      onSaved(routeRef(counterparty));
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: saveLock.release,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initial?.id) return;
      const { error } = await supabase.from("counterparties").delete().eq("id", initial.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Controparte eliminata");
      qc.invalidateQueries({ queryKey: ["counterparties"] });
      onCancel();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEdit && !duplicateOverride.current && canUseAuthHeaders()) {
      const candidates = await readServerResult<DuplicateCandidate[]>(
        await findDuplicates({
          data: {
            entityType: "counterparty",
            draft: {
              kind: form.kind,
              first_name: form.kind === "individual" ? form.first_name?.trim() || null : null,
              last_name: form.kind === "individual" ? form.last_name?.trim() || null : null,
              business_name: form.kind !== "individual" ? form.business_name?.trim() || null : null,
              subjectLabels: normalizedSubjects().map((subject) =>
                subject.kind === "company"
                  ? subject.business_name
                  : [subject.first_name, subject.last_name].filter(Boolean).join(" "),
              ),
            },
          },
          headers: await getAuthHeaders(),
        }),
      );
      if (candidates.length > 0) {
        setDuplicateCandidates(candidates);
        toast.error("Controlla i potenziali duplicati prima di creare la controparte");
        return;
      }
    }
    if (!saveLock.acquire()) return;
    saveMutation.mutate();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anagrafica</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="counterparty_kind">Tipo controparte</Label>
              <Select
                value={form.kind}
                onValueChange={(value) => upd("kind", value as CounterpartyKind)}
              >
                <SelectTrigger id="counterparty_kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(counterpartyKindLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.kind === "individual" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="last_name">Cognome</Label>
                <Input
                  id="last_name"
                  value={form.last_name ?? ""}
                  onChange={(event) => upd("last_name", event.target.value)}
                  placeholder="Es. Rossi"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="first_name">Nome</Label>
                <Input
                  id="first_name"
                  value={form.first_name ?? ""}
                  onChange={(event) => upd("first_name", event.target.value)}
                  placeholder="Es. Anna"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="business_name">
                {form.kind === "group" ? "Nome controparte composta" : "Ragione sociale"}
              </Label>
              <Input
                id="business_name"
                value={form.business_name ?? ""}
                onChange={(event) => upd("business_name", event.target.value)}
                placeholder={
                  form.kind === "group" ? "Es. Debitori collegati" : "Es. Debitore S.r.l."
                }
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(event) => upd("notes", event.target.value)}
              placeholder="Es. recapiti, ruolo nel credito o note di recupero"
            />
          </div>
        </CardContent>
      </Card>

      <DuplicateWarningPanel
        candidates={duplicateCandidates}
        onUseExisting={(record) => onSaved(record.publicCode || record.id)}
        onCreateAnyway={() => {
          duplicateOverride.current = true;
          setDuplicateCandidates([]);
          if (!saveLock.acquire()) return;
          saveMutation.mutate();
        }}
      />

      {form.kind === "group" && (
        <CounterpartySubjectsEditor
          subjects={subjects}
          setSubjects={setSubjects}
          markDirty={markDirty}
          onUpdate={updateSubject}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {isEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Trash2 className="mr-1 size-4" /> Elimina
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare la controparte?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'azione non può essere annullata. Le pratiche collegate potrebbero impedire
                    l'eliminazione.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annulla
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </div>
      {guardDialog}
    </form>
  );
}

async function createCounterparty(payload: {
  user_id: string;
  kind: CounterpartyKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
}) {
  const { data, error } = await supabase
    .from("counterparties")
    .insert(withTriggerGeneratedCode(payload))
    .select("id, public_code")
    .single();
  if (error) throw error;
  return data as { id: string; public_code: string | null };
}

async function updateCounterparty(
  id: string,
  payload: {
    user_id: string;
    kind: CounterpartyKind;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    notes: string | null;
  },
) {
  const { data, error } = await supabase
    .from("counterparties")
    .update(payload)
    .eq("id", id)
    .select("id, public_code")
    .single();
  if (error) throw error;
  return data as { id: string; public_code: string | null };
}

async function deleteSubjects(counterpartyId: string) {
  const { error } = await supabase
    .from("counterparty_subjects")
    .delete()
    .eq("counterparty_id", counterpartyId);
  if (error) throw error;
}

async function syncSubjects(counterpartyId: string, userId: string, subjects: SubjectRow[]) {
  await deleteSubjects(counterpartyId);

  if (subjects.length === 0) return;

  const payload = subjects.map((subject, index) => ({
    user_id: userId,
    counterparty_id: counterpartyId,
    kind: subject.kind,
    first_name: subject.kind === "individual" ? subject.first_name?.trim() || null : null,
    last_name: subject.kind === "individual" ? subject.last_name?.trim() || null : null,
    business_name: subject.kind === "company" ? subject.business_name?.trim() || null : null,
    notes: subject.notes?.trim() || null,
    position: index,
  }));

  const { error } = await supabase.from("counterparty_subjects").insert(payload);
  if (error) throw error;
}
