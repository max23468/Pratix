import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCcw, Trash2 } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CounterpartySelect, PrincipalSelect } from "@/components/debt-collection-selects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { caseStatusLabels, clientDisplayName } from "@/lib/labels";

type CaseRow = {
  id?: string;
  principal_id: string | null;
  client_id: string | null;
  counterparty_id: string | null;
  case_number: string;
  practice_number: number | null;
  title: string;
  matter: string;
  status: string;
  authority: string | null;
  rg_number: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const empty: CaseRow = {
  principal_id: null,
  client_id: null,
  counterparty_id: null,
  case_number: "",
  practice_number: null,
  title: "",
  matter: "civile",
  status: "open",
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
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<CaseRow>({
    ...empty,
    ...(defaultClientId ? { client_id: defaultClientId } : {}),
    ...(initial ?? {}),
  });

  const upd = <K extends keyof CaseRow>(key: K, value: CaseRow[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const { data: nextPracticeNumber, refetch: refetchNextPracticeNumber } = useQuery({
    queryKey: ["cases", "next-practice-number"],
    enabled: !isEdit,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_next_practice_number");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isEdit || form.practice_number || !nextPracticeNumber) return;
    setForm((current) => ({
      ...current,
      practice_number: nextPracticeNumber,
      case_number: String(nextPracticeNumber),
    }));
  }, [form.practice_number, isEdit, nextPracticeNumber]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "case-form"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, kind, first_name, last_name, business_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: principalClientIds = [] } = useQuery({
    queryKey: ["principal-clients", "case-form", form.principal_id],
    enabled: Boolean(form.principal_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principal_clients")
        .select("client_id")
        .eq("principal_id", form.principal_id ?? "");
      if (error) throw error;
      return (data ?? []).map((row) => row.client_id);
    },
  });

  const availableClients = useMemo(() => {
    if (!form.principal_id) return clients;
    const allowed = new Set(principalClientIds);
    return clients.filter((client) => allowed.has(client.id) || client.id === form.client_id);
  }, [clients, form.client_id, form.principal_id, principalClientIds]);

  useEffect(() => {
    if (!form.principal_id || !form.client_id) return;
    if (availableClients.some((client) => client.id === form.client_id)) return;
    upd("client_id", null);
  }, [availableClients, form.client_id, form.principal_id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!form.principal_id) throw new Error("Seleziona un committente");
      if (!form.client_id) throw new Error("Seleziona un cliente");
      if (!form.counterparty_id) throw new Error("Seleziona una controparte");

      const practiceNumber = Number(form.practice_number);
      if (!Number.isInteger(practiceNumber) || practiceNumber <= 0) {
        throw new Error("Inserisci un numero pratica numerico positivo");
      }

      const title = form.title.trim() || `Pratica ${practiceNumber}`;
      const payload = {
        user_id: user.id,
        principal_id: form.principal_id,
        client_id: form.client_id,
        counterparty_id: form.counterparty_id,
        practice_number: practiceNumber,
        case_number: String(practiceNumber),
        title,
        matter: "civile" as const,
        status: form.status as "open",
        fee_type: "flat" as const,
        agreed_fee: 0,
        hourly_rate: null,
        retainer: 0,
        counterparty: null,
        authority: form.authority?.trim() || null,
        rg_number: form.rg_number?.trim() || null,
        opened_at: form.opened_at || today(),
        closed_at: form.closed_at || null,
        notes: form.notes?.trim() || null,
      };

      if (isEdit && initial?.id) {
        const previousClientId = initial.client_id ?? null;
        const { data, error } = await supabase
          .from("cases")
          .update(payload)
          .eq("id", initial.id)
          .select("id")
          .single();
        if (error) throw error;

        if (previousClientId && previousClientId !== form.client_id) {
          const { error: transferError } = await supabase.from("case_credit_transfers").insert({
            user_id: user.id,
            case_id: initial.id,
            previous_client_id: previousClientId,
            new_client_id: form.client_id,
            transferred_at: new Date().toISOString(),
            notes: null,
          });
          if (transferError) throw transferError;
        }

        return data.id;
      }

      const { data, error } = await supabase.from("cases").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success(isEdit ? "Pratica aggiornata" : "Pratica creata");
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["case-credit-transfers", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onSaved(id);
    },
    onError: (error: Error) => toast.error(error.message),
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
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  const useNextPracticeNumber = async () => {
    const result = await refetchNextPracticeNumber();
    const number = result.data ?? nextPracticeNumber;
    if (!number) return;
    upd("practice_number", number);
    upd("case_number", String(number));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati pratica</CardTitle>
          <CardDescription>
            La pratica nasce dall'incrocio fra committente, cliente e controparte.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="principal_id">Committente</Label>
              <PrincipalSelect
                id="principal_id"
                value={form.principal_id}
                onValueChange={(value) => {
                  upd("principal_id", value);
                  upd("client_id", null);
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="client_id">Cliente</Label>
              <Select
                value={form.client_id ?? ""}
                onValueChange={(value) => upd("client_id", value)}
                disabled={!form.principal_id}
              >
                <SelectTrigger id="client_id">
                  <SelectValue
                    placeholder={
                      form.principal_id ? "Seleziona cliente" : "Prima scegli il committente"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {clientDisplayName(client)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.principal_id && availableClients.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nessun cliente collegato a questo committente.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="counterparty_id">Controparte</Label>
              <CounterpartySelect
                id="counterparty_id"
                value={form.counterparty_id}
                onValueChange={(value) => upd("counterparty_id", value)}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="practice_number">Numero pratica</Label>
              <div className="flex gap-2">
                <Input
                  id="practice_number"
                  type="number"
                  min="1"
                  step="1"
                  value={form.practice_number ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    const numericValue = value === "" ? null : Number(value);
                    upd("practice_number", numericValue);
                    upd("case_number", numericValue ? String(numericValue) : "");
                  }}
                  placeholder="157"
                />
                {!isEdit && (
                  <Button type="button" variant="outline" onClick={useNextPracticeNumber}>
                    <RefreshCcw className="mr-1 size-4" /> Prossimo
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Titolo</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => upd("title", event.target.value)}
                placeholder="Es. Recupero credito Gruppo 3C"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Stato pratica</Label>
              <Select value={form.status} onValueChange={(value) => upd("status", value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(caseStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="opened_at">Data apertura</Label>
              <Input
                id="opened_at"
                type="date"
                value={form.opened_at}
                onChange={(event) => upd("opened_at", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="closed_at">Data chiusura</Label>
              <Input
                id="closed_at"
                type="date"
                value={form.closed_at ?? ""}
                onChange={(event) => upd("closed_at", event.target.value || null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riferimenti</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="authority">Autorità giudiziaria</Label>
              <Input
                id="authority"
                value={form.authority ?? ""}
                onChange={(event) => upd("authority", event.target.value)}
                placeholder="Es. Tribunale di Milano"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rg_number">N. R.G.</Label>
              <Input
                id="rg_number"
                value={form.rg_number ?? ""}
                onChange={(event) => upd("rg_number", event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              rows={4}
              value={form.notes ?? ""}
              onChange={(event) => upd("notes", event.target.value)}
            />
          </div>
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
                  <AlertDialogTitle>Eliminare la pratica?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'eliminazione riguarda anche voci fatturabili, allegati e storico stati
                    associati. L'azione non può essere annullata.
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
