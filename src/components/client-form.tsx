import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type ClientRow = {
  id?: string;
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
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
  notes: string | null;
};

const empty: ClientRow = {
  kind: "individual",
  first_name: "",
  last_name: "",
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

  const isEdit = Boolean(initial?.id);

  const upd = (k: keyof ClientRow, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
        notes: form.notes?.trim() || null,
      };

      if (isEdit && initial?.id) {
        const { data, error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", initial.id)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      toast.success(isEdit ? "Cliente aggiornato" : "Cliente creato");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", id] });
      onSaved(id);
    },
    onError: (e: Error) => toast.error(e.message),
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.kind === "individual" && !form.first_name?.trim() && !form.last_name?.trim()) {
      toast.error("Inserisci nome e cognome");
      return;
    }
    if (form.kind === "company" && !form.business_name?.trim()) {
      toast.error("Inserisci la ragione sociale");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
                  <SelectItem value="company">Azienda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.kind === "individual" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fn">Nome</Label>
                <Input id="fn" value={form.first_name ?? ""} onChange={(e) => upd("first_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ln">Cognome</Label>
                <Input id="ln" value={form.last_name ?? ""} onChange={(e) => upd("last_name", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="bn">Ragione sociale</Label>
              <Input id="bn" value={form.business_name ?? ""} onChange={(e) => upd("business_name", e.target.value)} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tc">Codice fiscale</Label>
              <Input id="tc" value={form.tax_code ?? ""} onChange={(e) => upd("tax_code", e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat">Partita IVA</Label>
              <Input id="vat" value={form.vat_number ?? ""} onChange={(e) => upd("vat_number", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contatti e fatturazione elettronica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => upd("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input id="phone" value={form.phone ?? ""} onChange={(e) => upd("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pec">PEC</Label>
              <Input id="pec" type="email" value={form.pec ?? ""} onChange={(e) => upd("pec", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sdi">Codice destinatario SdI</Label>
              <Input
                id="sdi"
                value={form.sdi_code ?? ""}
                onChange={(e) => upd("sdi_code", e.target.value.toUpperCase().slice(0, 7))}
                placeholder="7 caratteri o 0000000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indirizzo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addr">Indirizzo</Label>
            <Input id="addr" value={form.address_street ?? ""} onChange={(e) => upd("address_street", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="city">Città</Label>
              <Input id="city" value={form.address_city ?? ""} onChange={(e) => upd("address_city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">CAP</Label>
              <Input id="zip" value={form.address_zip ?? ""} onChange={(e) => upd("address_zip", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prov">Prov.</Label>
              <Input
                id="prov"
                value={form.address_province ?? ""}
                maxLength={2}
                onChange={(e) => upd("address_province", e.target.value.toUpperCase())}
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
          <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => upd("notes", e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {isEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Trash2 className="mr-1 h-4 w-4" /> Elimina
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
                  <AlertDialogAction onClick={() => deleteMutation.mutate()}>Elimina</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Annulla</Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </div>
    </form>
  );
}
