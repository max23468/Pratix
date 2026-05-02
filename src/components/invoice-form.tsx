import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { clientDisplayName, invoiceStatusLabels, type InvoiceStatus } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import {
  computeInvoice,
  invoiceLineKindLabels,
  type InvoiceLineInput,
  type InvoiceLineKind,
} from "@/lib/invoice-calc";
import { reserveInvoiceNumber } from "@/server/invoices.functions";

type LineDraft = {
  id?: string;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unit_price: number;
};

type InvoiceFormValues = {
  id?: string;
  client_id: string;
  case_id: string | null;
  number: string;
  year: number;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  cassa_rate: number;
  vat_rate: number;
  withholding_rate: number;
  apply_withholding: boolean;
  payment_method: string | null;
  notes: string | null;
  paid_at: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyLine = (kind: InvoiceLineKind = "fee"): LineDraft => ({
  kind,
  description: "",
  quantity: 1,
  unit_price: 0,
});

type Props = {
  initialInvoice?: Partial<InvoiceFormValues>;
  initialLines?: LineDraft[];
  invoiceId?: string;
};

export function InvoiceForm({ initialInvoice, initialLines, invoiceId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile-invoice-defaults", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "cassa_rate, vat_rate, withholding_rate, apply_withholding, tax_regime, invoice_year, invoice_next_number, invoice_number_prefix",
        )
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-min", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, kind, first_name, last_name, business_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [values, setValues] = useState<InvoiceFormValues>(() => ({
    client_id: initialInvoice?.client_id ?? "",
    case_id: initialInvoice?.case_id ?? null,
    number: initialInvoice?.number ?? "",
    year: initialInvoice?.year ?? new Date().getFullYear(),
    issue_date: initialInvoice?.issue_date ?? today(),
    due_date: initialInvoice?.due_date ?? null,
    status: initialInvoice?.status ?? "draft",
    cassa_rate: Number(initialInvoice?.cassa_rate ?? 4),
    vat_rate: Number(initialInvoice?.vat_rate ?? 22),
    withholding_rate: Number(initialInvoice?.withholding_rate ?? 20),
    apply_withholding: initialInvoice?.apply_withholding ?? true,
    payment_method: initialInvoice?.payment_method ?? "Bonifico",
    notes: initialInvoice?.notes ?? null,
    paid_at: initialInvoice?.paid_at ?? null,
    id: initialInvoice?.id,
  }));

  const [lines, setLines] = useState<LineDraft[]>(
    initialLines && initialLines.length > 0 ? initialLines : [emptyLine("fee")],
  );

  // Applica default profilo solo per nuove fatture
  useEffect(() => {
    if (invoiceId || !profile) return;
    setValues((v) => ({
      ...v,
      cassa_rate: Number(profile.cassa_rate ?? v.cassa_rate),
      vat_rate: Number(profile.vat_rate ?? v.vat_rate),
      withholding_rate: Number(profile.withholding_rate ?? v.withholding_rate),
      apply_withholding: profile.apply_withholding ?? v.apply_withholding,
    }));
  }, [profile, invoiceId]);

  // Pratiche del cliente selezionato
  const { data: cases } = useQuery({
    queryKey: ["cases-of-client", values.client_id],
    enabled: !!values.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_number, title")
        .eq("client_id", values.client_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Spese non ancora fatturate della pratica
  const { data: pendingExpenses } = useQuery({
    queryKey: ["pending-expenses", values.case_id],
    enabled: !!values.case_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, description, amount, is_art15, expense_date, category")
        .eq("case_id", values.case_id!)
        .is("invoice_id", null)
        .order("expense_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const totals = useMemo(
    () =>
      computeInvoice(
        lines.map<InvoiceLineInput>((l) => ({
          kind: l.kind,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        {
          cassaRate: values.cassa_rate,
          vatRate: values.vat_rate,
          withholdingRate: values.withholding_rate,
          applyWithholding: values.apply_withholding,
          taxRegime: (profile?.tax_regime as "ordinario" | "forfettario") ?? "ordinario",
        },
      ),
    [lines, values, profile],
  );

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = (kind: InvoiceLineKind) => {
    setLines((prev) => [...prev, emptyLine(kind)]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const importPendingExpenses = () => {
    if (!pendingExpenses || pendingExpenses.length === 0) {
      toast.info("Nessuna spesa pendente per questa pratica.");
      return;
    }
    const newLines: LineDraft[] = pendingExpenses.map((e) => ({
      kind: e.is_art15 ? "expense_art15" : "expense_taxable",
      description: e.description,
      quantity: 1,
      unit_price: Number(e.amount),
    }));
    setLines((prev) => [...prev.filter((l) => l.description || l.unit_price), ...newLines]);
    toast.success(`Importate ${newLines.length} spese.`);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      if (!values.client_id) throw new Error("Seleziona un cliente");
      if (lines.length === 0) throw new Error("Aggiungi almeno una riga");

      let invoiceNumber = values.number;
      let invoiceYear = values.year;

      // Riserva numero solo per nuove fatture senza numero
      if (!invoiceId && !invoiceNumber) {
        const reserved = await reserveInvoiceNumber();
        invoiceNumber = reserved.number;
        invoiceYear = reserved.year;
      }

      const payload = {
        user_id: user.id,
        client_id: values.client_id,
        case_id: values.case_id,
        number: invoiceNumber,
        year: invoiceYear,
        issue_date: values.issue_date,
        due_date: values.due_date,
        status: values.status,
        cassa_rate: values.cassa_rate,
        vat_rate: values.vat_rate,
        withholding_rate: values.withholding_rate,
        apply_withholding: values.apply_withholding,
        payment_method: values.payment_method,
        notes: values.notes,
        paid_at: values.status === "paid" ? (values.paid_at ?? today()) : null,
        taxable_fees: totals.taxableFees,
        taxable_expenses: totals.taxableExpenses,
        art15_expenses: totals.art15Expenses,
        cassa_amount: totals.cassaAmount,
        vat_amount: totals.vatAmount,
        withholding_amount: totals.withholdingAmount,
        stamp_amount: totals.stampAmount,
        total_amount: totals.totalAmount,
        net_to_pay: totals.netToPay,
      };

      let savedId = invoiceId;
      if (invoiceId) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", invoiceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("invoices")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      // Sostituisci righe (cancella e re-inserisci, semplice e robusto per MVP)
      if (invoiceId) {
        const { error: delErr } = await supabase
          .from("invoice_lines")
          .delete()
          .eq("invoice_id", invoiceId);
        if (delErr) throw delErr;
      }

      const linesPayload = lines.map((l, i) => ({
        invoice_id: savedId!,
        user_id: user.id,
        kind: l.kind,
        description: l.description || invoiceLineKindLabels[l.kind],
        quantity: l.quantity,
        unit_price: l.unit_price,
        amount: Math.round((l.quantity * l.unit_price + Number.EPSILON) * 100) / 100,
        position: i,
      }));
      if (linesPayload.length > 0) {
        const { error: linesErr } = await supabase.from("invoice_lines").insert(linesPayload);
        if (linesErr) throw linesErr;
      }

      // Collega le spese importate dalla pratica (se presenti)
      if (values.case_id && pendingExpenses && pendingExpenses.length > 0) {
        const importedDescriptions = new Set(
          lines
            .filter((l) => l.kind === "expense_art15" || l.kind === "expense_taxable")
            .map((l) => l.description),
        );
        const toLink = pendingExpenses
          .filter((e) => importedDescriptions.has(e.description))
          .map((e) => e.id);
        if (toLink.length > 0) {
          await supabase.from("expenses").update({ invoice_id: savedId }).in("id", toLink);
        }
      }

      return savedId!;
    },
    onSuccess: (id) => {
      toast.success(invoiceId ? "Fattura aggiornata" : "Fattura creata");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      navigate({ to: "/fatture/$invoiceId", params: { invoiceId: id } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Dati fattura</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Cliente *</Label>
              <Select
                value={values.client_id}
                onValueChange={(v) => setValues((s) => ({ ...s, client_id: v, case_id: null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clients || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {clientDisplayName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pratica (opzionale)</Label>
              <Select
                value={values.case_id ?? "none"}
                onValueChange={(v) =>
                  setValues((s) => ({ ...s, case_id: v === "none" ? null : v }))
                }
                disabled={!values.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nessuna pratica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nessuna —</SelectItem>
                  {(cases || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stato</Label>
              <Select
                value={values.status}
                onValueChange={(v) => setValues((s) => ({ ...s, status: v as InvoiceStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(invoiceStatusLabels).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {invoiceId && (
              <div className="space-y-2">
                <Label>Numero</Label>
                <Input
                  value={values.number}
                  onChange={(e) => setValues((s) => ({ ...s, number: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Data emissione *</Label>
              <Input
                type="date"
                value={values.issue_date}
                onChange={(e) => setValues((s) => ({ ...s, issue_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Scadenza pagamento</Label>
              <Input
                type="date"
                value={values.due_date ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, due_date: e.target.value || null }))}
              />
            </div>

            {values.status === "paid" && (
              <div className="space-y-2">
                <Label>Data pagamento</Label>
                <Input
                  type="date"
                  value={values.paid_at ?? today()}
                  onChange={(e) => setValues((s) => ({ ...s, paid_at: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Modalità di pagamento</Label>
              <Input
                value={values.payment_method ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, payment_method: e.target.value }))}
                placeholder="Bonifico"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Righe</CardTitle>
            <div className="flex flex-wrap gap-2">
              {values.case_id && (
                <Button type="button" size="sm" variant="outline" onClick={importPendingExpenses}>
                  Importa spese pratica
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => addLine("fee")}>
                <Plus className="mr-1 h-4 w-4" /> Compenso
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addLine("expense_taxable")}
              >
                <Plus className="mr-1 h-4 w-4" /> Spesa imp.
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addLine("expense_art15")}
              >
                <Plus className="mr-1 h-4 w-4" /> Art. 15
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.length === 0 && <p className="text-sm text-muted-foreground">Nessuna riga.</p>}
            {lines.map((l, idx) => {
              const amount = Math.round((l.quantity * l.unit_price + Number.EPSILON) * 100) / 100;
              return (
                <div
                  key={idx}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[140px_1fr_80px_120px_120px_auto] sm:items-end"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={l.kind}
                      onValueChange={(v) => updateLine(idx, { kind: v as InvoiceLineKind })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(invoiceLineKindLabels).map(([k, lbl]) => (
                          <SelectItem key={k} value={k}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrizione</Label>
                    <Input
                      value={l.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      placeholder="Es. Esame della pratica e redazione atto"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Q.tà</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prezzo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.unit_price}
                      onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Importo</Label>
                    <div className="flex h-9 items-center justify-end rounded-md border bg-muted/40 px-3 text-sm font-medium">
                      {formatCurrency(amount)}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeLine(idx)}
                    aria-label="Rimuovi riga"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parametri fiscali</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Cassa Forense %</Label>
              <Input
                type="number"
                step="0.01"
                value={values.cassa_rate}
                onChange={(e) =>
                  setValues((s) => ({ ...s, cassa_rate: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>IVA %</Label>
              <Input
                type="number"
                step="0.01"
                value={values.vat_rate}
                onChange={(e) =>
                  setValues((s) => ({ ...s, vat_rate: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ritenuta %</Label>
              <Input
                type="number"
                step="0.01"
                value={values.withholding_rate}
                onChange={(e) =>
                  setValues((s) => ({
                    ...s,
                    withholding_rate: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-3">
              <Switch
                id="apply-withholding"
                checked={values.apply_withholding}
                onCheckedChange={(v) => setValues((s) => ({ ...s, apply_withholding: v }))}
              />
              <Label htmlFor="apply-withholding">Applica ritenuta d'acconto</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={values.notes ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, notes: e.target.value || null }))}
              placeholder="Note che appariranno in fondo alla fattura"
              rows={3}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Riepilogo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <SummaryRow label="Imponibile compensi" value={totals.taxableFees} />
            <SummaryRow label="Spese imponibili" value={totals.taxableExpenses} />
            <SummaryRow
              label={`Cassa Forense (${values.cassa_rate}%)`}
              value={totals.cassaAmount}
            />
            <SummaryRow label={`IVA (${values.vat_rate}%)`} value={totals.vatAmount} />
            <SummaryRow label="Spese Art. 15" value={totals.art15Expenses} />
            <SummaryRow label="Bollo" value={totals.stampAmount} />
            <Separator />
            <SummaryRow label="Totale documento" value={totals.totalAmount} bold />
            {totals.withholdingAmount > 0 && (
              <SummaryRow
                label={`Ritenuta (${values.withholding_rate}%)`}
                value={-totals.withholdingAmount}
              />
            )}
            <Separator />
            <SummaryRow label="Netto a pagare" value={totals.netToPay} bold />

            <Button
              className="mt-4 w-full"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {saveMutation.isPending
                ? "Salvataggio…"
                : invoiceId
                  ? "Salva modifiche"
                  : "Crea fattura"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
