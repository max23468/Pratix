import { useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  InvoiceActivitiesSection,
  InvoiceBillingDetailsSection,
  InvoiceNotesSection,
  InvoiceSummarySection,
} from "@/components/invoice-form-sections";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { computeInvoice, type InvoiceLineInput } from "@/lib/invoice-calc";
import {
  buildQuarterOptions,
  currentQuarterOption,
  quarterKeyForPeriod,
  quarterOption,
  todayDateInput,
} from "@/lib/invoice-period";
import { publicCodeLookup } from "@/lib/public-route-code";
import { readServerResult } from "@/lib/server-functions";
import { useSubmitLock } from "@/lib/submit-lock";
import {
  createBillingInvoiceFn,
  updateDraftBillingInvoiceFn,
} from "@/server/invoices-create.functions";

type BillingItemStatus = "included" | "postponed" | "excluded";
type PeriodMode = "quarter" | "custom";

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
  needs_review: boolean;
  invoice_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  postponed_until: string | null;
  cases: { practice_number: number } | null;
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

function useInvoiceForm(draftInvoiceRef?: string) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createBillingInvoice = useServerFn(createBillingInvoiceFn);
  const updateDraftBillingInvoice = useServerFn(updateDraftBillingInvoiceFn);
  const qc = useQueryClient();
  const initialQuarter = useMemo(() => currentQuarterOption(), []);
  const quarterOptions = useMemo(() => buildQuarterOptions(), []);
  const isEditingDraft = Boolean(draftInvoiceRef);
  const [principalId, setPrincipalId] = useState("");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("quarter");
  const [selectedQuarter, setSelectedQuarter] = useState(initialQuarter.key);
  const [periodStart, setPeriodStart] = useState(initialQuarter.start);
  const [periodEnd, setPeriodEnd] = useState(initialQuarter.end);
  const [issueDate, setIssueDate] = useState(() => todayDateInput());
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
  const [requestId] = useState(() => crypto.randomUUID());
  const [selection, setSelection] = useState<Record<string, BillingItemStatus>>({});
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [appliedProfileDefaultsKey, setAppliedProfileDefaultsKey] = useState<string | null>(null);
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

  const includeStampDuty = Boolean(profile?.include_stamp_duty);
  const displayedQuarterOptions = useMemo(() => {
    if (quarterOptions.some((option) => option.key === selectedQuarter)) return quarterOptions;
    const [yearPart, quarterPart] = selectedQuarter.split("-Q");
    const year = Number(yearPart);
    const quarterNumber = Number(quarterPart);
    if (!year || !quarterNumber) return quarterOptions;
    return [quarterOption(year, quarterNumber), ...quarterOptions];
  }, [quarterOptions, selectedQuarter]);

  const applyQuarter = (quarterKey: string) => {
    const option =
      displayedQuarterOptions.find((item) => item.key === quarterKey) ??
      quarterOptions.find((item) => item.key === quarterKey);
    if (!option) return;
    setSelectedQuarter(option.key);
    setPeriodStart(option.start);
    setPeriodEnd(option.end);
  };

  const {
    data: draftData,
    error: draftError,
    isError: draftIsError,
    isLoading: draftLoading,
  } = useQuery({
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

  const profileDefaultsKey =
    profile && !isEditingDraft
      ? [
          profile.cassa_rate ?? 4,
          profile.vat_rate ?? 22,
          profile.withholding_rate ?? 20,
          profile.tax_regime ?? "",
        ].join("|")
      : null;

  if (profile && profileDefaultsKey && appliedProfileDefaultsKey !== profileDefaultsKey) {
    setCassaRate(Number(profile.cassa_rate ?? 4));
    setVatRate(Number(profile.vat_rate ?? 22));
    setWithholdingRate(Number(profile.withholding_rate ?? 20));
    setApplyWithholding(profile.tax_regime !== "forfettario");
    setAppliedProfileDefaultsKey(profileDefaultsKey);
  }

  if (draftData && loadedDraftId !== draftData.invoice.id) {
    setPrincipalId(draftData.invoice.principal_id ?? "");
    setPeriodStart(draftData.billingRun.period_start);
    setPeriodEnd(draftData.billingRun.period_end);
    const draftQuarterKey = quarterKeyForPeriod(
      draftData.billingRun.period_start,
      draftData.billingRun.period_end,
    );
    setPeriodMode(draftQuarterKey ? "quarter" : "custom");
    if (draftQuarterKey) setSelectedQuarter(draftQuarterKey);
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
  }

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
        "id, activity_date, kind, status, needs_review, invoice_id, description, quantity, unit_price, amount, postponed_until, cases(practice_number), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)";
      const availableQuery = supabase
        .from("case_activities")
        .select(activitySelect)
        .eq("principal_id", principalId)
        .eq("status", "to_invoice")
        .is("invoice_id", null)
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

  const selectionForActivities = useMemo(() => {
    const next: Record<string, BillingItemStatus> = {};
    activities.forEach((activity) => {
      next[activity.id] = selection[activity.id] ?? "included";
    });
    return next;
  }, [activities, selection]);

  const includedActivities = useMemo(
    () => activities.filter((activity) => selectionForActivities[activity.id] === "included"),
    [activities, selectionForActivities],
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
        requestId,
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
          status: selectionForActivities[activity.id] ?? "excluded",
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

  const isDraftFormHydrated =
    !isEditingDraft || Boolean(draftData && loadedDraftId === draftData.invoice.id);

  return {
    draftIsError,
    draftError,
    isEditingDraft,
    draftLoading,
    isDraftFormHydrated,
    saveInvoice,
    includedActivities,
    formRef,
    handleSubmit,
    principalId,
    setPrincipalId,
    principals,
    markDirty,
    periodMode,
    setPeriodMode,
    selectedQuarter,
    displayedQuarterOptions,
    applyQuarter,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    activitiesLoading,
    activities,
    selectionForActivities,
    setSelection,
    issueDate,
    setIssueDate,
    dueDate,
    setDueDate,
    includeGeneralExpenses,
    setIncludeGeneralExpenses,
    generalExpensesRate,
    setGeneralExpensesRate,
    cassaRate,
    setCassaRate,
    vatRate,
    setVatRate,
    withholdingRate,
    setWithholdingRate,
    applyWithholding,
    setApplyWithholding,
    paymentMethod,
    setPaymentMethod,
    notes,
    setNotes,
    totals,
    pendingInvoiceStatus,
    guardDialog,
    isForfettario,
  };
}

export type InvoiceFormController = ReturnType<typeof useInvoiceForm>;

export function InvoiceForm({ draftInvoiceRef }: { draftInvoiceRef?: string }) {
  const controller = useInvoiceForm(draftInvoiceRef);
  const {
    draftIsError,
    draftError,
    isEditingDraft,
    draftLoading,
    isDraftFormHydrated,
    saveInvoice,
    includedActivities,
    formRef,
    handleSubmit,
    guardDialog,
  } = controller;

  if (isEditingDraft && draftIsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Modifica bozza</CardTitle>
          <CardDescription>
            {draftError instanceof Error
              ? draftError.message
              : "La fattura in bozza non è disponibile."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isEditingDraft && (draftLoading || !isDraftFormHydrated)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Modifica bozza</CardTitle>
          <CardDescription>Caricamento della fattura in bozza…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const submitDisabled =
    saveInvoice.isPending ||
    includedActivities.length === 0 ||
    draftLoading ||
    !isDraftFormHydrated;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="min-w-0 space-y-4">
        <InvoiceBillingDetailsSection controller={controller} />
        <InvoiceActivitiesSection controller={controller} />
        <InvoiceNotesSection controller={controller} />
      </div>

      <InvoiceSummarySection controller={controller} submitDisabled={submitDisabled} />
      {guardDialog}
    </form>
  );
}
