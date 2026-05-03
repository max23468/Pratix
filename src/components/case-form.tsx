import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { caseMatterLabels, caseStatusLabels, clientDisplayName } from "@/lib/labels";

type CaseRow = {
  id?: string;
  client_id: string | null;
  case_number: string;
  title: string;
  matter: string;
  status: string;
  fee_type: string;
  hourly_rate: number | null;
  agreed_fee: number | null;
  retainer: number | null;
  counterparty: string | null;
  authority: string | null;
  rg_number: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const empty: CaseRow = {
  client_id: null,
  case_number: "",
  title: "",
  matter: "civile",
  status: "open",
  fee_type: "flat",
  hourly_rate: null,
  agreed_fee: 0,
  retainer: 0,
  counterparty: "",
  authority: "",
  rg_number: "",
  opened_at: today(),
  closed_at: null,
  notes: "",
};

type Props = {
  initial?: Partial<CaseRow> & { id?: string };
  defaultClientId?: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function CaseForm({ initial, defaultClientId, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<CaseRow>({
    ...empty,
    ...(defaultClientId ? { client_id: defaultClientId } : {}),
    ...(initial ?? {}),
  });

  const isEdit = Boolean(initial?.id);

  const upd = <K extends keyof CaseRow>(k: K, v: CaseRow[K]) => setForm((f) => ({ ...f, [k]: v }));

  const { data: clients } = useQuery({
    queryKey: ["clients", "for-case"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, kind, first_name, last_name, business_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!form.client_id) throw new Error("Seleziona un cliente");
      if (!form.case_number.trim()) throw new Error("Inserisci il numero pratica");
      if (!form.title.trim()) throw new Error("Inserisci il titolo della pratica");

      const payload = {
        user_id: user.id,
        client_id: form.client_id,
        case_number: form.case_number.trim(),
        title: form.title.trim(),
        matter: form.matter as "civile",
        status: form.status as "open",
        fee_type: form.fee_type as "flat",
        hourly_rate: form.fee_type === "hourly" ? Number(form.hourly_rate ?? 0) : null,
        agreed_fee: Number(form.agreed_fee ?? 0),
        retainer: Number(form.retainer ?? 0),
        counterparty: form.counterparty?.trim() || null,
        authority: form.authority?.trim() || null,
        rg_number: form.rg_number?.trim() || null,
        opened_at: form.opened_at || today(),
        closed_at: form.closed_at || null,
        notes: form.notes?.trim() || null,
      };

      if (isEdit && initial?.id) {
        const { data, error } = await supabase
          .from("cases")
          .update(payload)
          .eq("id", initial.id)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      } else {
        const { data, error } = await supabase.from("cases").insert(payload).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      toast.success(isEdit ? "Pratica aggiornata" : "Pratica creata");
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onSaved(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initial?.id) return;
      const { error } = await supabase.from("cases").delete().eq("id", initial.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pratica eliminata");
      qc.invalidateQueries({ queryKey: ["cases"] });
      onCancel();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati pratica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <Select value={form.client_id ?? ""} onValueChange={(v) => upd("client_id", v)}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Seleziona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {clientDisplayName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="num">Numero pratica</Label>
              <Input
                id="num"
                value={form.case_number}
                onChange={(e) => upd("case_number", e.target.value)}
                placeholder="es. 2026/001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titolo</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => upd("title", e.target.value)}
              placeholder="Oggetto della pratica"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="matter">Materia</Label>
              <Select value={form.matter} onValueChange={(v) => upd("matter", v)}>
                <SelectTrigger id="matter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(caseMatterLabels).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Stato</Label>
              <Select value={form.status} onValueChange={(v) => upd("status", v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(caseStatusLabels).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opened">Data apertura</Label>
              <Input
                id="opened"
                type="date"
                value={form.opened_at}
                onChange={(e) => upd("opened_at", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compenso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fee_type">Tipo compenso</Label>
              <Select value={form.fee_type} onValueChange={(v) => upd("fee_type", v)}>
                <SelectTrigger id="fee_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">A forfait</SelectItem>
                  <SelectItem value="hourly">A ore</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.fee_type === "hourly" ? (
              <div className="space-y-2">
                <Label htmlFor="hr">Tariffa oraria (€)</Label>
                <Input
                  id="hr"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.hourly_rate ?? ""}
                  onChange={(e) =>
                    upd("hourly_rate", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="fee">Compenso pattuito (€)</Label>
                <Input
                  id="fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.agreed_fee ?? 0}
                  onChange={(e) => upd("agreed_fee", Number(e.target.value))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="retainer">Acconto ricevuto (€)</Label>
              <Input
                id="retainer"
                type="number"
                step="0.01"
                min="0"
                value={form.retainer ?? 0}
                onChange={(e) => upd("retainer", Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riferimenti procedimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cp">Controparte</Label>
              <Input
                id="cp"
                value={form.counterparty ?? ""}
                onChange={(e) => upd("counterparty", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth">Autorità giudiziaria</Label>
              <Input
                id="auth"
                value={form.authority ?? ""}
                onChange={(e) => upd("authority", e.target.value)}
                placeholder="es. Tribunale di Milano"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rg">N. R.G.</Label>
              <Input
                id="rg"
                value={form.rg_number ?? ""}
                onChange={(e) => upd("rg_number", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closed">Data chiusura</Label>
              <Input
                id="closed"
                type="date"
                value={form.closed_at ?? ""}
                onChange={(e) => upd("closed_at", e.target.value || null)}
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
            rows={4}
            value={form.notes ?? ""}
            onChange={(e) => upd("notes", e.target.value)}
          />
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
                  <AlertDialogTitle>Eliminare la pratica?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'eliminazione riguarda anche spese e storico stati associati. L'azione non può
                    essere annullata.
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
    </form>
  );
}
