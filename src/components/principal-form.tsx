import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DuplicateWarningPanel } from "@/components/duplicate-warning-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { supabase } from "@/integrations/supabase/client";
import { withTriggerGeneratedCode } from "@/integrations/supabase/insert-helpers";
import { useAuth } from "@/lib/auth-context";
import type { DuplicateCandidate } from "@/lib/duplicate-matching";
import { routeRef } from "@/lib/public-route-code";
import { canUseAuthHeaders, getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { useSubmitLock } from "@/lib/submit-lock";
import { findDuplicateCandidatesFn } from "@/server/duplicates.functions";

type PrincipalRow = {
  id?: string;
  public_code?: string | null;
  business_name: string;
  tax_code: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  pec: string | null;
  sdi_code: string | null;
  address_street: string | null;
  address_city: string | null;
  address_zip: string | null;
  address_province: string | null;
  address_country: string | null;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
  default_general_expenses_rate: number;
  default_cassa_rate: number;
  notes: string | null;
  archived_at: string | null;
};

const empty: PrincipalRow = {
  business_name: "",
  tax_code: "",
  vat_number: "",
  email: "",
  phone: "",
  pec: "",
  sdi_code: "",
  address_street: "",
  address_city: "",
  address_zip: "",
  address_province: "",
  address_country: "IT",
  fees_enabled: true,
  expense_reimbursements_enabled: true,
  default_general_expenses_rate: 10,
  default_cassa_rate: 4,
  notes: "",
  archived_at: null,
};

type Props = {
  initial?: Partial<PrincipalRow> & { id?: string };
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function PrincipalForm({ initial, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<PrincipalRow>({ ...empty, ...(initial ?? {}) });
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const duplicateOverride = useRef(false);
  const isEdit = Boolean(initial?.id);
  const isArchived = Boolean(form.archived_at);
  const { finishSave, formRef, guardDialog, markDirty } = useUnsavedChangesGuard();
  const saveLock = useSubmitLock();
  const findDuplicates = useServerFn(findDuplicateCandidatesFn);

  const upd = <K extends keyof PrincipalRow>(k: K, v: PrincipalRow[K]) => {
    markDirty();
    setForm((current) => ({ ...current, [k]: v }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!form.business_name.trim()) throw new Error("Inserisci la ragione sociale");
      if (!form.fees_enabled && !form.expense_reimbursements_enabled) {
        throw new Error("Abilita almeno compensi o rimborsi spese");
      }

      const payload = {
        user_id: user.id,
        business_name: form.business_name.trim(),
        tax_code: form.tax_code?.trim() || null,
        vat_number: form.vat_number?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        pec: form.pec?.trim() || null,
        sdi_code: form.sdi_code?.trim() || null,
        address_street: form.address_street?.trim() || null,
        address_city: form.address_city?.trim() || null,
        address_zip: form.address_zip?.trim() || null,
        address_province: form.address_province?.trim() || null,
        address_country: form.address_country?.trim() || "IT",
        fees_enabled: form.fees_enabled,
        expense_reimbursements_enabled: form.expense_reimbursements_enabled,
        default_general_expenses_rate: Number(form.default_general_expenses_rate || 0),
        default_cassa_rate: Number(form.default_cassa_rate || 0),
        notes: form.notes?.trim() || null,
        archived_at: form.archived_at,
      };

      if (isEdit && initial?.id) {
        const { data, error } = await supabase
          .from("principals")
          .update(payload)
          .eq("id", initial.id)
          .select("id, public_code")
          .single();
        if (error) throw error;
        return data as { id: string; public_code: string | null };
      }

      const { data, error } = await supabase
        .from("principals")
        .insert(withTriggerGeneratedCode(payload))
        .select("id, public_code")
        .single();
      if (error) throw error;
      return data as { id: string; public_code: string | null };
    },
    onSuccess: (principal) => {
      toast.success(isEdit ? "Committente aggiornato" : "Committente creato");
      qc.invalidateQueries({ queryKey: ["principals"] });
      qc.invalidateQueries({ queryKey: ["principal", principal.id] });
      if (finishSave()) return;
      onSaved(routeRef(principal));
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: saveLock.release,
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!initial?.id) throw new Error("Committente non salvato");
      const archived_at = isArchived ? null : new Date().toISOString();
      const { data, error } = await supabase
        .from("principals")
        .update({ archived_at })
        .eq("id", initial.id)
        .select("id, archived_at")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setForm((current) => ({ ...current, archived_at: data.archived_at }));
      toast.success(data.archived_at ? "Committente archiviato" : "Committente riattivato");
      qc.invalidateQueries({ queryKey: ["principals"] });
      qc.invalidateQueries({ queryKey: ["principal", data.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.business_name.trim()) {
      toast.error("Inserisci la ragione sociale");
      return;
    }
    if (!form.fees_enabled && !form.expense_reimbursements_enabled) {
      toast.error("Abilita almeno compensi o rimborsi spese");
      return;
    }
    if (!isEdit && !duplicateOverride.current && canUseAuthHeaders()) {
      const candidates = await readServerResult<DuplicateCandidate[]>(
        await findDuplicates({
          data: {
            entityType: "principal",
            draft: {
              business_name: form.business_name.trim(),
              tax_code: form.tax_code?.trim() || null,
              vat_number: form.vat_number?.trim() || null,
              email: form.email?.trim() || null,
              pec: form.pec?.trim() || null,
              phone: form.phone?.trim() || null,
            },
          },
          headers: await getAuthHeaders(),
        }),
      );
      if (candidates.length > 0) {
        setDuplicateCandidates(candidates);
        toast.error("Controlla i potenziali duplicati prima di creare il committente");
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
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="business_name">Ragione sociale</Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={(event) => upd("business_name", event.target.value)}
                placeholder="Es. Banca Alfa S.p.A."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tax_code">Codice fiscale</Label>
              <Input
                id="tax_code"
                value={form.tax_code ?? ""}
                onChange={(event) => upd("tax_code", event.target.value.toUpperCase())}
                placeholder="Es. 01234567890"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vat_number">Partita IVA</Label>
              <Input
                id="vat_number"
                value={form.vat_number ?? ""}
                onChange={(event) => upd("vat_number", event.target.value)}
                placeholder="Es. 01234567890"
              />
            </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regole economiche</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="fees_enabled">Compensi</Label>
                <p className="text-xs text-muted-foreground">Abilita voci imponibili.</p>
              </div>
              <Switch
                id="fees_enabled"
                checked={form.fees_enabled}
                onCheckedChange={(checked) => upd("fees_enabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="expense_reimbursements_enabled">Rimborsi spese</Label>
                <p className="text-xs text-muted-foreground">Abilita anticipazioni Art. 15.</p>
              </div>
              <Switch
                id="expense_reimbursements_enabled"
                checked={form.expense_reimbursements_enabled}
                onCheckedChange={(checked) => upd("expense_reimbursements_enabled", checked)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="general_expenses">Spese generali (%)</Label>
              <Input
                id="general_expenses"
                type="number"
                min="0"
                step="0.01"
                value={form.default_general_expenses_rate}
                onChange={(event) =>
                  upd("default_general_expenses_rate", Number(event.target.value))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cassa_rate">Cassa forense (%)</Label>
              <Input
                id="cassa_rate"
                type="number"
                min="0"
                step="0.01"
                value={form.default_cassa_rate}
                onChange={(event) => upd("default_cassa_rate", Number(event.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contatti</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(event) => upd("email", event.target.value)}
              placeholder="Es. amministrazione@bancaalfa.it"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Telefono</Label>
            <Input
              id="phone"
              value={form.phone ?? ""}
              onChange={(event) => upd("phone", event.target.value)}
              placeholder="Es. 0212345678"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pec">PEC</Label>
            <Input
              id="pec"
              type="email"
              value={form.pec ?? ""}
              onChange={(event) => upd("pec", event.target.value)}
              placeholder="Es. bancaalfa@pec.it"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sdi_code">Codice destinatario SdI</Label>
            <Input
              id="sdi_code"
              value={form.sdi_code ?? ""}
              onChange={(event) => upd("sdi_code", event.target.value.toUpperCase().slice(0, 7))}
              placeholder="Es. 0000000"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indirizzo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="address_street">Indirizzo</Label>
            <Input
              id="address_street"
              value={form.address_street ?? ""}
              onChange={(event) => upd("address_street", event.target.value)}
              placeholder="Es. Via Roma 10"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="address_city">Città</Label>
              <Input
                id="address_city"
                value={form.address_city ?? ""}
                onChange={(event) => upd("address_city", event.target.value)}
                placeholder="Es. Milano"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address_zip">CAP</Label>
              <Input
                id="address_zip"
                value={form.address_zip ?? ""}
                onChange={(event) => upd("address_zip", event.target.value)}
                placeholder="Es. 20121"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address_province">Prov.</Label>
              <Input
                id="address_province"
                maxLength={2}
                value={form.address_province ?? ""}
                onChange={(event) => upd("address_province", event.target.value.toUpperCase())}
                placeholder="MI"
              />
            </div>
          </div>
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
            onChange={(event) => upd("notes", event.target.value)}
            placeholder="Es. regole operative, referente o istruzioni di fatturazione"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              {isArchived ? (
                <ArchiveRestore className="mr-1 size-4" />
              ) : (
                <Archive className="mr-1 size-4" />
              )}
              {isArchived ? "Riattiva" : "Archivia"}
            </Button>
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
