import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DuplicateWarningPanel } from "@/components/duplicate-warning-panel";
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
import { clientKindLabels, counterpartyKindLabels } from "@/lib/labels";
import type { DuplicateCandidate } from "@/lib/duplicate-matching";
import { routeRef } from "@/lib/public-route-code";
import { canUseAuthHeaders, getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { useSubmitLock } from "@/lib/submit-lock";
import { findDuplicateCandidatesFn } from "@/server/duplicates.functions";

type CounterpartyKind = "individual" | "company" | "group";
type SubjectKind = "individual" | "company";

type CounterpartyRow = {
  id?: string;
  public_code?: string | null;
  kind: CounterpartyKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
};

type SubjectRow = {
  id?: string;
  kind: SubjectKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
  position: number;
};

type SubjectDraft = SubjectRow & { clientKey: string };

const emptyCounterparty: CounterpartyRow = {
  kind: "company",
  first_name: "",
  last_name: "",
  business_name: "",
  notes: "",
};

const emptySubject = (position: number): SubjectDraft => ({
  clientKey: crypto.randomUUID(),
  kind: "individual",
  first_name: "",
  last_name: "",
  business_name: "",
  notes: "",
  position,
});

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
    subjects
      .map(({ clientKey: _clientKey, ...subject }, index) => ({ ...subject, position: index }))
      .filter((subject) => {
        if (subject.kind === "company") return Boolean(subject.business_name?.trim());
        return Boolean(subject.first_name?.trim() || subject.last_name?.trim());
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
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Soggetti della controparte</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  markDirty();
                  setSubjects((current) => [...current, emptySubject(current.length)]);
                }}
              >
                <Plus className="mr-1 size-4" /> Soggetto
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {subjects.map((subject, index) => (
              <div key={subject.clientKey} className="rounded-md border border-border p-4">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Soggetto {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      markDirty();
                      setSubjects((current) =>
                        current.length === 1
                          ? [emptySubject(0)]
                          : current.filter((_, currentIndex) => currentIndex !== index),
                      );
                    }}
                  >
                    <Trash2 className="mr-1 size-4" /> Rimuovi
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`subject_kind_${index}`}>Tipo</Label>
                    <Select
                      value={subject.kind}
                      onValueChange={(value) => updateSubject(index, "kind", value as SubjectKind)}
                    >
                      <SelectTrigger id={`subject_kind_${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(clientKindLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {subject.kind === "company" ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`subject_business_${index}`}>Ragione sociale</Label>
                      <Input
                        id={`subject_business_${index}`}
                        value={subject.business_name ?? ""}
                        onChange={(event) =>
                          updateSubject(index, "business_name", event.target.value)
                        }
                        placeholder="Es. Debitore S.r.l."
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`subject_last_${index}`}>Cognome</Label>
                        <Input
                          id={`subject_last_${index}`}
                          value={subject.last_name ?? ""}
                          onChange={(event) =>
                            updateSubject(index, "last_name", event.target.value)
                          }
                          placeholder="Es. Rossi"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`subject_first_${index}`}>Nome</Label>
                        <Input
                          id={`subject_first_${index}`}
                          value={subject.first_name ?? ""}
                          onChange={(event) =>
                            updateSubject(index, "first_name", event.target.value)
                          }
                          placeholder="Es. Anna"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor={`subject_notes_${index}`}>Note</Label>
                    <Textarea
                      id={`subject_notes_${index}`}
                      rows={2}
                      value={subject.notes ?? ""}
                      onChange={(event) => updateSubject(index, "notes", event.target.value)}
                      placeholder="Es. ruolo del soggetto nella controparte"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
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
