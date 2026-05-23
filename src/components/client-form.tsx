import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DuplicateWarningPanel } from "@/components/duplicate-warning-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/lib/auth-context";
import type { DuplicateCandidate } from "@/lib/duplicate-matching";
import { routeRef } from "@/lib/public-route-code";
import { canUseAuthHeaders, getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { useSubmitLock } from "@/lib/submit-lock";
import { findDuplicateCandidatesFn } from "@/server/duplicates.functions";

type ClientRow = {
  id?: string;
  public_code?: string | null;
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
};

const empty: ClientRow = {
  kind: "individual",
  first_name: "",
  last_name: "",
  business_name: "",
  notes: "",
};

type Props = {
  initial?: Partial<ClientRow> & { id?: string };
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function ClientForm({ initial, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<ClientRow>({ ...empty, ...(initial ?? {}) });
  const [selectedPrincipalIds, setSelectedPrincipalIds] = useState<string[] | null>(null);
  const [principalLinkError, setPrincipalLinkError] = useState<string | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateOverride, setDuplicateOverride] = useState(false);
  const saveLock = useSubmitLock();
  const findDuplicates = useServerFn(findDuplicateCandidatesFn);

  const isEdit = Boolean(initial?.id);
  const { finishSave, formRef, guardDialog, markDirty } = useUnsavedChangesGuard();

  const upd = (k: keyof ClientRow, v: string) => {
    markDirty();
    setForm((f) => ({ ...f, [k]: v }));
  };

  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "client-form"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name, archived_at")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: linkedPrincipalIds } = useQuery({
    queryKey: ["principal-clients", initial?.id],
    enabled: Boolean(initial?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principal_clients")
        .select("principal_id")
        .eq("client_id", initial?.id ?? "");
      if (error) throw error;
      return (data ?? []).map((link) => link.principal_id);
    },
  });

  const effectiveSelectedPrincipalIds = selectedPrincipalIds ?? linkedPrincipalIds ?? [];

  const togglePrincipal = (principalId: string, checked: boolean) => {
    if (checked) setPrincipalLinkError(null);
    markDirty();
    setSelectedPrincipalIds((current) => {
      const selectedIds = current ?? linkedPrincipalIds ?? [];
      return checked
        ? [...selectedIds, principalId]
        : selectedIds.filter((id) => id !== principalId);
    });
  };

  const validatePrincipalLinks = () => {
    if (effectiveSelectedPrincipalIds.length > 0) return true;
    const message =
      principals.length === 0
        ? "Aggiungi un committente prima di salvare il cliente"
        : "Collega il cliente ad almeno un committente";
    setPrincipalLinkError(message);
    toast.error(message);
    return false;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");

      const payload = {
        ...form,
        kind: form.kind as "individual" | "company",
        user_id: user.id,
        // pulizia campi vuoti
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        business_name: form.business_name?.trim() || null,
        notes: form.notes?.trim() || null,
      };

      const clientId =
        isEdit && initial?.id
          ? await updateClient(initial.id, payload)
          : await createClient(payload);

      await syncPrincipalLinks(clientId.id, user.id, effectiveSelectedPrincipalIds);

      return clientId;
    },
    onSuccess: (client) => {
      toast.success(isEdit ? "Cliente aggiornato" : "Cliente creato");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["principal-clients", client.id] });
      if (finishSave()) return;
      onSaved(routeRef(client));
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: saveLock.release,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initial?.id) return;
      const { error } = await supabase.from("clients").delete().eq("id", initial.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente eliminato");
      qc.invalidateQueries({ queryKey: ["clients"] });
      onCancel();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.kind === "individual" && !form.first_name?.trim() && !form.last_name?.trim()) {
      toast.error("Inserisci nome e cognome");
      return;
    }
    if (form.kind === "company" && !form.business_name?.trim()) {
      toast.error("Inserisci la ragione sociale");
      return;
    }
    if (!validatePrincipalLinks()) return;
    if (!isEdit && !duplicateOverride && canUseAuthHeaders()) {
      const candidates = await readServerResult<DuplicateCandidate[]>(
        await findDuplicates({
          data: {
            entityType: "client",
            draft: {
              kind: form.kind,
              first_name: form.first_name?.trim() || null,
              last_name: form.last_name?.trim() || null,
              business_name: form.business_name?.trim() || null,
            },
          },
          headers: await getAuthHeaders(),
        }),
      );
      if (candidates.length > 0) {
        setDuplicateCandidates(candidates);
        toast.error("Controlla i potenziali duplicati prima di creare il cliente");
        return;
      }
    }
    if (!saveLock.acquire()) return;
    saveMutation.mutate();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anagrafica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kind">Tipo cliente</Label>
              <Select value={form.kind} onValueChange={(v) => upd("kind", v)}>
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Privato</SelectItem>
                  <SelectItem value="company">Società</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.kind === "individual" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ln">Cognome</Label>
                <Input
                  id="ln"
                  value={form.last_name ?? ""}
                  onChange={(e) => upd("last_name", e.target.value)}
                  placeholder="Es. Rossi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fn">Nome</Label>
                <Input
                  id="fn"
                  value={form.first_name ?? ""}
                  onChange={(e) => upd("first_name", e.target.value)}
                  placeholder="Es. Anna"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="bn">Ragione sociale</Label>
              <Input
                id="bn"
                value={form.business_name ?? ""}
                onChange={(e) => upd("business_name", e.target.value)}
                placeholder="Es. Alfa S.r.l."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <DuplicateWarningPanel
        candidates={duplicateCandidates}
        onUseExisting={(record) => onSaved(record.publicCode || record.id)}
        onCreateAnyway={() => {
          if (!validatePrincipalLinks()) return;
          setDuplicateOverride(true);
          setDuplicateCandidates([]);
          if (!saveLock.acquire()) return;
          saveMutation.mutate();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Committenti collegati</CardTitle>
          <p className="text-sm text-muted-foreground">
            Seleziona almeno un committente: il collegamento è obbligatorio per salvare il cliente.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {principalLinkError && (
            <Alert id="principal-link-error" variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Committente obbligatorio</AlertTitle>
              <AlertDescription>{principalLinkError}</AlertDescription>
            </Alert>
          )}
          {principals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aggiungi un committente per collegarlo a questo cliente.
            </p>
          ) : (
            principals.map((principal) => (
              <label
                key={principal.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{principal.business_name}</span>
                  {principal.archived_at && (
                    <span className="text-xs text-muted-foreground">Archiviato</span>
                  )}
                </span>
                <Checkbox
                  checked={effectiveSelectedPrincipalIds.includes(principal.id)}
                  aria-describedby={principalLinkError ? "principal-link-error" : undefined}
                  onCheckedChange={(checked) => togglePrincipal(principal.id, checked === true)}
                />
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Note</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => upd("notes", e.target.value)}
            placeholder="Es. collegamento al committente o note operative"
          />
        </CardContent>
      </Card>

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
                  <AlertDialogTitle>Eliminare il cliente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'azione non può essere annullata. Le pratiche collegate non verranno eliminate
                    ma resteranno senza cliente.
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

async function createClient(payload: {
  kind: "individual" | "company";
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
}) {
  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("id, public_code")
    .single();
  if (error) throw error;
  return data as { id: string; public_code: string | null };
}

async function updateClient(
  id: string,
  payload: {
    kind: "individual" | "company";
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    notes: string | null;
  },
) {
  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", id)
    .select("id, public_code")
    .single();
  if (error) throw error;
  return data as { id: string; public_code: string | null };
}

async function syncPrincipalLinks(clientId: string, userId: string, principalIds: string[]) {
  const { error: deleteError } = await supabase
    .from("principal_clients")
    .delete()
    .eq("client_id", clientId);
  if (deleteError) throw deleteError;

  const uniquePrincipalIds = Array.from(new Set(principalIds));
  if (uniquePrincipalIds.length === 0) return;

  const { error } = await supabase.from("principal_clients").insert(
    uniquePrincipalIds.map((principalId) => ({
      user_id: userId,
      client_id: clientId,
      principal_id: principalId,
    })),
  );
  if (error) throw error;
}
