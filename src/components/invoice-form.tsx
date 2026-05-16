import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { computeInvoice, type InvoiceLineInput } from "@/lib/invoice-calc";
import { formatCurrency, formatDate } from "@/lib/format";
import { counterpartyDisplayName, clientDisplayName } from "@/lib/labels";
import { publicCodeLookup } from "@/lib/public-route-code";
import { useSubmitLock } from "@/lib/submit-lock";
import { createBillingInvoiceFn, updateDraftBillingInvoiceFn } from "@/server/invoices.functions";

type BillingItemStatus = "included" | "postponed" | "excluded";

const EMPTY_ACTIVITIES: ActivityRow[] = [];

type CreateBillingInvoiceResult = {
  invoiceId: string;
  invoiceRef: string;
  billingRunId: string;
  number: string;
  year: number;
  exports: Array<{ id: string; file_name: string }>;
};

type DraftInvoiceData = {
  invoice: {
    id: string;
    principal_id: string | null;
    issue_date: string;
    due_date: string | null;
    status: string;
    billing_run_id: string | null;
    include_general_expenses: boolean;
    general_expenses_rate: number | string | null;
    cassa_rate: number | string;
    vat_rate: number | string;
    withholding_rate: number | string;
    apply_withholding: boolean;
    payment_method: string | null;
    notes: string | null;
  };
  billingRun: {
    period_start: string;
    period_end: string;
  };
  items: Array<{ activity_id: string; status: BillingItemStatus }>;
};

const unwrapServerResult = <T,>(result: T | { data: T }) =>
  "data" in Object(result) ? (result as { data: T }).data : (result as T);

const readServerResult = async <T,>(result: T | { data: T } | Response) => {
  if (result instanceof Response) {
    if (!result.ok) throw new Error(await result.text());
    const contentType = result.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return unwrapServerResult<T>(await result.json());
    }
    throw new Error("Risposta server non valida");
  }
  return unwrapServerResult<T>(result);
};

type PrincipalRow = {
  id: string;
  business_name: string;
  default_general_expenses_rate: number;
  default_cassa_rate: number;
};

type ActivityRow = {
  id: string;
  activity_date: string;
  kind: "fee" | "expense_reimbursement";
  status: "to_invoice" | "invoiced";
  invoice_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  postponed_until: string | null;
  cases: { practice_number: number; title: string } | null;
  clients: {
    kind: string;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
  } | null;
  counterparties: {
    kind: string;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
  } | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const currentQuarter = () => {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

const billingStatusLabels: Record<BillingItemStatus, string> = {
  included: "Includi",
  postponed: "Rinvia",
  excluded: "Escludi",
};

export function InvoiceForm({ draftInvoiceRef }: { draftInvoiceRef?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createBillingInvoice = useServerFn(createBillingInvoiceFn);
  const updateDraftBillingInvoice = useServerFn(updateDraftBillingInvoiceFn);
  const qc = useQueryClient();
  const quarter = useMemo(() => currentQuarter(), []);
  const isEditingDraft = Boolean(draftInvoiceRef);
  const [principalId, setPrincipalId] = useState("");
  const [periodStart, setPeriodStart] = useState(quarter.start);
  const [periodEnd, setPeriodEnd] = useState(quarter.end);
  const [issueDate, setIssueDate] = useState(() => today());
  const [dueDate, setDueDate] = useState("");
  const [pendingInvoiceStatus, setPendingInvoiceStatus] = useState<"draft" | "issued" | null>(null);
  const [includeGeneralExpenses, setIncludeGeneralExpenses] = useState(true);
  const [generalExpensesRate, setGeneralExpensesRate] = useState(10);
  const [cassaRate, setCassaRate] = useState(4);
  const [vatRate, setVatRate] = useState(22);
  const [withholdingRate, setWithholdingRate] = useState(20);
  const [applyWithholding, setApplyWithholding] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("Bonifico bancario");
  const [notes, setNotes] = useState("");
  const [selection, setSelection] = useState<Record<string, BillingItemStatus>>({});
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const { finishSave, formRef, guardDialog, markDirty } = useUnsavedChangesGuard();
  const createInvoiceLock = useSubmitLock();

  const { data: profile } = useQuery({
    queryKey: ["profile", "invoice-form", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("cassa_rate, vat_rate, withholding_rate, tax_regime, include_stamp_duty")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "invoice-form", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name, default_general_expenses_rate, default_cassa_rate")
        .is("archived_at", null)
        .order("business_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrincipalRow[];
    },
  });

  const selectedPrincipal = principals.find((principal) => principal.id === principalId) ?? null;
  const includeStampDuty = Boolean(profile?.include_stamp_duty);

  const { data: draftData, isLoading: draftLoading } = useQuery({
    queryKey: ["invoice-draft-edit", draftInvoiceRef, user?.id],
    enabled: Boolean(user && draftInvoiceRef),
    queryFn: async () => {
      const lookup = publicCodeLookup(draftInvoiceRef!);
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq(lookup.column, lookup.value)
        .eq("user_id", user!.id)
        .single();
      if (invoiceError) throw invoiceError;
      if (invoice.status !== "draft") throw new Error("Solo le fatture in bozza sono modificabili");
      if (!invoice.billing_run_id) throw new Error("Bozza senza rendiconto collegato");

      const [{ data: billingRun, error: runError }, { data: items, error: itemsError }] =
        await Promise.all([
          supabase
            .from("billing_runs")
            .select("period_start, period_end")
            .eq("id", invoice.billing_run_id)
            .single(),
          supabase
            .from("billing_run_items")
            .select("activity_id, status")
            .eq("billing_run_id", invoice.billing_run_id),
        ]);
      if (runError) throw runError;
      if (itemsError) throw itemsError;
      if (!billingRun) throw new Error("Rendiconto della bozza non trovato");

      return {
        invoice,
        billingRun,
        items: (items ?? []).filter(
          (item): item is { activity_id: string; status: BillingItemStatus } =>
            typeof item.activity_id === "string" &&
            (item.status === "included" ||
              item.status === "postponed" ||
              item.status === "excluded"),
        ),
      } satisfies DraftInvoiceData;
    },
  });

  const draftActivityIds = useMemo(
    () => (draftData?.items ?? []).map((item) => item.activity_id),
    [draftData?.items],
  );

  const draftInvoiceDbId = draftData?.invoice.id ?? null;

  useEffect(() => {
    if (!profile || isEditingDraft) return;
    setCassaRate(Number(profile.cassa_rate ?? 4));
    setVatRate(Number(profile.vat_rate ?? 22));
    setWithholdingRate(Number(profile.withholding_rate ?? 20));
    setApplyWithholding(profile.tax_regime !== "forfettario");
  }, [isEditingDraft, profile]);

  useEffect(() => {
    if (!selectedPrincipal || isEditingDraft) return;
    setGeneralExpensesRate(Number(selectedPrincipal.default_general_expenses_rate ?? 10));
    setCassaRate(Number(selectedPrincipal.default_cassa_rate ?? 4));
  }, [isEditingDraft, selectedPrincipal]);

  useEffect(() => {
    if (!draftData || loadedDraftId === draftData.invoice.id) return;
    setPrincipalId(draftData.invoice.principal_id ?? "");
    setPeriodStart(draftData.billingRun.period_start);
    setPeriodEnd(draftData.billingRun.period_end);
    setIssueDate(draftData.invoice.issue_date);
    setDueDate(draftData.invoice.due_date ?? "");
    setIncludeGeneralExpenses(draftData.invoice.include_general_expenses);
    setGeneralExpensesRate(Number(draftData.invoice.general_expenses_rate ?? 0));
    setCassaRate(Number(draftData.invoice.cassa_rate));
    setVatRate(Number(draftData.invoice.vat_rate));
    setWithholdingRate(Number(draftData.invoice.withholding_rate));
    setApplyWithholding(draftData.invoice.apply_withholding);
    setPaymentMethod(draftData.invoice.payment_method ?? "");
    setNotes(draftData.invoice.notes ?? "");
    setSelection(
      Object.fromEntries(draftData.items.map((item) => [item.activity_id, item.status] as const)),
    );
    setLoadedDraftId(draftData.invoice.id);
  }, [draftData, loadedDraftId]);

  const { data: activities = EMPTY_ACTIVITIES, isLoading: activitiesLoading } = useQuery({
    queryKey: [
      "billing-activities",
      principalId,
      periodStart,
      periodEnd,
      draftInvoiceDbId,
      draftActivityIds.join(","),
    ],
    enabled: Boolean(
      user && principalId && periodStart && periodEnd && (!isEditingDraft || draftData),
    ),
    queryFn: async () => {
      const activitySelect =
        "id, activity_date, kind, status, invoice_id, description, quantity, unit_price, amount, postponed_until, cases(practice_number, title), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)";
      const availableQuery = supabase
        .from("case_activities")
        .select(activitySelect)
        .eq("principal_id", principalId)
        .eq("status", "to_invoice")
        .lte("activity_date", periodEnd)
        .order("activity_date", { ascending: true });

      const draftActivitiesQuery =
        draftActivityIds.length > 0
          ? supabase
              .from("case_activities")
              .select(activitySelect)
              .in("id", draftActivityIds)
              .order("activity_date", { ascending: true })
          : Promise.resolve({ data: [], error: null });

      const [
        { data: availableActivities, error: availableError },
        { data: draftActivities, error: draftError },
      ] = await Promise.all([availableQuery, draftActivitiesQuery]);
      if (availableError) throw availableError;
      if (draftError) throw draftError;

      const activitiesById = new Map<string, ActivityRow>();
      for (const activity of [
        ...((availableActivities ?? []) as ActivityRow[]),
        ...((draftActivities ?? []) as ActivityRow[]),
      ]) {
        activitiesById.set(activity.id, activity);
      }

      const draftIds = new Set(draftActivityIds);
      return Array.from(activitiesById.values()).filter(
        (activity) =>
          draftIds.has(activity.id) ||
          (activity.status === "to_invoice" &&
            (!activity.postponed_until || activity.postponed_until <= periodEnd)),
      );
    },
  });

  useEffect(() => {
    setSelection((current) => {
      const next: Record<string, BillingItemStatus> = {};
      activities.forEach((activity) => {
        next[activity.id] = current[activity.id] ?? "included";
      });
      const nextKeys = Object.keys(next);
      const currentKeys = Object.keys(current);
      if (
        nextKeys.length === currentKeys.length &&
        nextKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }
      return next;
    });
  }, [activities]);

  const includedActivities = useMemo(
    () => activities.filter((activity) => selection[activity.id] === "included"),
    [activities, selection],
  );
  const isForfettario = profile?.tax_regime === "forfettario";

  const totals = useMemo(() => {
    const lines: InvoiceLineInput[] = includedActivities.map((activity) => ({
      kind: activity.kind === "fee" ? "fee" : "expense_art15",
      quantity: Number(activity.quantity),
      unit_price: Number(activity.unit_price),
    }));
    return computeInvoice(lines, {
      cassaRate,
      vatRate,
      withholdingRate,
      applyWithholding,
      taxRegime: isForfettario ? "forfettario" : "ordinario",
      includeGeneralExpenses,
      generalExpensesRate,
      includeStampDuty,
    });
  }, [
    applyWithholding,
    cassaRate,
    generalExpensesRate,
    includeGeneralExpenses,
    includeStampDuty,
    includedActivities,
    isForfettario,
    vatRate,
    withholdingRate,
  ]);

  const saveInvoice = useMutation({
    mutationFn: async (status: "draft" | "issued") => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessione non valida. Accedi di nuovo.");
      const payload = {
        principalId,
        periodStart,
        periodEnd,
        issueDate,
        dueDate: dueDate || null,
        status,
        includeGeneralExpenses,
        generalExpensesRate,
        cassaRate,
        vatRate,
        withholdingRate,
        applyWithholding,
        paymentMethod,
        notes,
        selections: activities.map((activity) => ({
          activityId: activity.id,
          status: selection[activity.id] ?? "excluded",
        })),
      };
      const result = isEditingDraft
        ? await updateDraftBillingInvoice({
            data: {
              ...payload,
              invoiceId: draftData?.invoice.id ?? "",
            },
            headers: { Authorization: `Bearer ${token}` },
          })
        : await createBillingInvoice({
            data: payload,
            headers: { Authorization: `Bearer ${token}` },
          });
      return readServerResult<CreateBillingInvoiceResult>(result);
    },
    onSuccess: (invoice, status) => {
      toast.success(
        isEditingDraft
          ? status === "draft"
            ? `Bozza ${invoice.number}/${invoice.year} aggiornata`
            : `Fattura ${invoice.number}/${invoice.year} emessa`
          : status === "draft"
            ? `Bozza ${invoice.number}/${invoice.year} salvata`
            : `Fattura ${invoice.number}/${invoice.year} creata`,
      );
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice", draftInvoiceRef] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      if (finishSave()) return;
      navigate({ to: "/fatture/$invoiceId", params: { invoiceId: invoice.invoiceRef } });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => {
      setPendingInvoiceStatus(null);
      createInvoiceLock.release();
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = submitter?.value === "issued" ? "issued" : "draft";
    if (!createInvoiceLock.acquire()) return;
    setPendingInvoiceStatus(status);
    saveInvoice.mutate(status);
  };

  if (isEditingDraft && draftLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Modifica bozza</CardTitle>
          <CardDescription>Caricamento della fattura in bozza…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const submitDisabled = saveInvoice.isPending || includedActivities.length === 0 || draftLoading;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="min-w-0 space-y-4">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Dati fatturazione</CardTitle>
            <CardDescription>
              Estrai le attività da fatturare per committente e periodo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="principal_id">Committente</Label>
              <Select
                value={principalId}
                onValueChange={(value) => {
                  markDirty();
                  setPrincipalId(value);
                }}
              >
                <SelectTrigger id="principal_id">
                  <SelectValue placeholder="Seleziona committente" />
                </SelectTrigger>
                <SelectContent>
                  {principals.map((principal) => (
                    <SelectItem key={principal.id} value={principal.id}>
                      {principal.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DateField
              id="period_start"
              label="Da"
              value={periodStart}
              onChange={(value) => {
                markDirty();
                setPeriodStart(value);
              }}
            />
            <DateField
              id="period_end"
              label="A"
              value={periodEnd}
              onChange={(value) => {
                markDirty();
                setPeriodEnd(value);
              }}
            />
            <DateField
              id="issue_date"
              label="Data fattura"
              value={issueDate}
              onChange={(value) => {
                markDirty();
                setIssueDate(value);
              }}
            />
            <DateField
              id="due_date"
              label="Scadenza"
              value={dueDate}
              onChange={(value) => {
                markDirty();
                setDueDate(value);
              }}
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment_method">Pagamento</Label>
              <Input
                id="payment_method"
                value={paymentMethod}
                onChange={(event) => {
                  markDirty();
                  setPaymentMethod(event.target.value);
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Attività</CardTitle>
            <CardDescription>
              Le voci incluse entrano in fattura; le rinviate ricompariranno dal periodo successivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-w-0 overflow-x-auto">
              <Table className="block w-full sm:table">
                <TableHeader className="hidden sm:table-header-group">
                  <TableRow>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Pratica</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Controparte</TableHead>
                    <TableHead>Voce</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activitiesLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Caricamento…
                      </TableCell>
                    </TableRow>
                  )}
                  {!activitiesLoading && activities.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nessuna attività da fatturare per il periodo selezionato.
                      </TableCell>
                    </TableRow>
                  )}
                  {activities.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="mb-3 block rounded-lg border border-border p-3 last:mb-0 sm:mb-0 sm:table-row sm:rounded-none sm:border-x-0 sm:border-t-0 sm:p-0"
                    >
                      <TableCell className="block p-0 pb-3 sm:table-cell sm:p-2">
                        <Select
                          value={selection[activity.id] ?? "included"}
                          onValueChange={(value) => {
                            markDirty();
                            setSelection((current) => ({
                              ...current,
                              [activity.id]: value as BillingItemStatus,
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full sm:w-32" aria-label="Stato attività">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(billingStatusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="flex justify-between gap-3 text-sm sm:table-cell">
                        <span className="shrink-0 text-muted-foreground sm:hidden">Data</span>
                        <span className="text-right sm:text-left">
                          {formatDate(activity.activity_date)}
                        </span>
                      </TableCell>
                      <TableCell className="flex justify-between gap-3 text-sm sm:table-cell">
                        <span className="shrink-0 text-muted-foreground sm:hidden">Pratica</span>
                        <span className="min-w-0 break-words text-right sm:text-left">
                          {activity.cases?.practice_number
                            ? `N. ${activity.cases.practice_number}`
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="flex justify-between gap-3 text-sm sm:table-cell">
                        <span className="shrink-0 text-muted-foreground sm:hidden">Cliente</span>
                        <span className="min-w-0 break-words text-right sm:text-left">
                          {activity.clients ? clientDisplayName(activity.clients) : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="flex justify-between gap-3 text-sm sm:table-cell">
                        <span className="shrink-0 text-muted-foreground sm:hidden">
                          Controparte
                        </span>
                        <span className="min-w-0 break-words text-right sm:text-left">
                          {activity.counterparties
                            ? counterpartyDisplayName(activity.counterparties)
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="block text-sm sm:table-cell">
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground sm:hidden">Voce</span>
                          <span className="break-words">{activity.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {activity.kind === "fee" ? "Compenso" : "Rimborso spese"} · Q.tà{" "}
                            {activity.quantity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="flex justify-between gap-3 text-sm font-medium sm:table-cell sm:text-right">
                        <span className="shrink-0 font-normal text-muted-foreground sm:hidden">
                          Totale
                        </span>
                        <span className="text-right">
                          {formatCurrency(Number(activity.amount))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(event) => {
                markDirty();
                setNotes(event.target.value);
              }}
              placeholder="Note interne o descrizione da riportare in fattura"
            />
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Regole fiscali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SwitchRow
              label="Spese generali"
              checked={includeGeneralExpenses}
              onCheckedChange={(value) => {
                markDirty();
                setIncludeGeneralExpenses(value);
              }}
            />
            <NumberField
              id="general_expenses_rate"
              label="Percentuale spese generali"
              value={generalExpensesRate}
              onChange={(value) => {
                markDirty();
                setGeneralExpensesRate(value);
              }}
              disabled={!includeGeneralExpenses}
            />
            <NumberField
              id="cassa_rate"
              label="Cassa Forense"
              value={cassaRate}
              onChange={(value) => {
                markDirty();
                setCassaRate(value);
              }}
            />
            <NumberField
              id="vat_rate"
              label="IVA"
              value={vatRate}
              onChange={(value) => {
                markDirty();
                setVatRate(value);
              }}
            />
            <SwitchRow
              label="Ritenuta d'acconto"
              checked={applyWithholding}
              onCheckedChange={(value) => {
                markDirty();
                setApplyWithholding(value);
              }}
            />
            <NumberField
              id="withholding_rate"
              label="Aliquota ritenuta"
              value={withholdingRate}
              onChange={(value) => {
                markDirty();
                setWithholdingRate(value);
              }}
              disabled={!applyWithholding}
            />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Riepilogo</CardTitle>
            <CardDescription>{includedActivities.length} attività incluse</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow label="Compensi" value={totals.taxableFees} />
            {totals.generalExpensesAmount > 0 && (
              <SummaryRow label="Spese generali" value={totals.generalExpensesAmount} />
            )}
            <SummaryRow label="Cassa Forense" value={totals.cassaAmount} />
            {!isForfettario && <SummaryRow label="IVA" value={totals.vatAmount} />}
            <SummaryRow label="Rimborsi Art. 15" value={totals.art15Expenses} />
            {totals.stampAmount > 0 && <SummaryRow label="Bollo" value={totals.stampAmount} />}
            <div className="border-t border-border pt-3">
              <SummaryRow label="Totale documento" value={totals.totalAmount} strong />
              <SummaryRow label="Netto a pagare" value={totals.netToPay} strong />
            </div>
            <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="mt-0.5 size-4 shrink-0" />
              <span>La fattura genera anche i rendiconti Excel per compensi e rimborsi.</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="submit"
                name="invoiceStatus"
                value="draft"
                variant="outline"
                className="w-full"
                disabled={submitDisabled}
              >
                {pendingInvoiceStatus === "draft" && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Salva bozza
              </Button>
              <Button
                type="submit"
                name="invoiceStatus"
                value="issued"
                className="w-full"
                disabled={submitDisabled}
              >
                {pendingInvoiceStatus === "issued" && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {isEditingDraft ? "Segna come emessa" : "Crea fattura"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      {guardDialog}
    </form>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label} (%)</Label>
      <Input
        id={id}
        type="number"
        min="0"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div
      className={
        strong ? "flex justify-between text-sm font-semibold" : "flex justify-between text-sm"
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
