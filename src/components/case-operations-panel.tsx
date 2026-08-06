import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileText,
  FileSpreadsheet,
  ListChecks,
  Plus,
  Receipt,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseTimeline } from "@/components/case-timeline-card";
import { CaseOperationsSummary } from "@/components/case-operations-summary";
import { SummaryTile } from "@/components/summary-tile";
import { SubjectTile } from "@/components/subject-tile";
import { Separator } from "@/components/ui/separator";
import { WorkflowField } from "@/components/workflow-field";
import { WorkflowPriorityBadge } from "@/components/workflow-priority-badge";
import { CaseActivityDialog, type CaseActivityDialogActivity } from "@/components/case-activities";
import { supabase } from "@/integrations/supabase/client";
import { buildCaseDossierWorkbook, type CaseDossierInput } from "@/lib/case-dossier-xlsx";
import {
  buildCaseTimelineItems,
  sortedHearings,
  type CaseTimelineActivity as ActivityRow,
  type CaseTimelineHistoryItem as HistoryRow,
  type CaseTimelineInvoice as InvoiceRow,
  type CaseTimelineParty,
  type CaseTimelineTransfer as TransferRow,
} from "@/lib/case-timeline";
import {
  buildCaseWorkflowQualityChecks,
  buildDebtCollectionWorkflow,
  summarizeCaseOperations,
} from "@/lib/case-workflow";
import { downloadBytes } from "@/lib/file-downloads";
import { formatCurrency } from "@/lib/format";
import {
  caseActivityStatusLabels,
  caseStatusLabels,
  clientDisplayName,
  counterpartyDisplayName,
  invoiceStatusLabels,
  priceItemKindLabels,
  practiceDisplayName,
  type ClientDisplayData,
  type CounterpartyDisplayData,
} from "@/lib/labels";
export { CaseTimeline } from "@/components/case-timeline-card";
export { WorkflowPriorityBadge } from "@/components/workflow-priority-badge";

type OperationsActivityRow = ActivityRow & CaseActivityDialogActivity;

export type CaseOperationsCase = {
  id: string;
  principal_id: string | null;
  client_id: string | null;
  counterparty_id: string | null;
  practice_number: number;
  status: string;
  opened_at: string;
  closed_at?: string | null;
  updated_at: string;
  authority?: string | null;
  rg_number?: string | null;
  notes?: string | null;
  principals?: { business_name: string | null } | null;
  clients?: CaseTimelineParty | null;
  counterparties?: CaseTimelineParty | null;
};

export function CaseOperationsPanel({
  caseRow,
  afterDashboardSlot,
  detailsSlot,
}: {
  caseRow: CaseOperationsCase;
  afterDashboardSlot?: ReactNode;
  detailsSlot?: ReactNode;
}) {
  const [editingActivity, setEditingActivity] = useState<OperationsActivityRow | null>(null);
  const {
    data: activities = [],
    isFetching: activitiesFetching,
    isLoading: activitiesLoading,
  } = useCaseActivities(caseRow.id);
  const {
    data: invoices = [],
    isFetching: invoicesFetching,
    isLoading: invoicesLoading,
  } = useCaseInvoices(caseRow.id);
  const {
    data: history = [],
    isFetching: historyFetching,
    isLoading: historyLoading,
  } = useCaseHistory(caseRow.id);
  const {
    data: transfers = [],
    isFetching: transfersFetching,
    isLoading: transfersLoading,
  } = useCaseTransfers(caseRow.id);

  const principalName = caseRow.principals?.business_name ?? "—";
  const clientName = caseRow.clients
    ? clientDisplayName(caseRow.clients as ClientDisplayData)
    : "—";
  const counterpartyName = caseRow.counterparties
    ? counterpartyDisplayName(caseRow.counterparties as CounterpartyDisplayData)
    : "—";

  const totals = useMemo(
    () => summarizeCaseOperations(activities, invoices),
    [activities, invoices],
  );
  const qualityChecks = useMemo(
    () => buildCaseWorkflowQualityChecks({ caseRow, activities, invoices, totals }),
    [activities, caseRow, invoices, totals],
  );
  const timeline = useMemo(
    () => buildCaseTimelineItems({ caseRow, activities, invoices, history, transfers }),
    [activities, caseRow, history, invoices, transfers],
  );
  const isLoading =
    activitiesLoading ||
    invoicesLoading ||
    historyLoading ||
    transfersLoading ||
    activitiesFetching ||
    invoicesFetching ||
    historyFetching ||
    transfersFetching;
  const dossierDownloadsDisabled = isLoading;

  const nextAction = getNextAction({ activities, invoices, attachmentCount: totals.attachments });
  const workflow = useMemo(
    () =>
      buildDebtCollectionWorkflow({
        caseRow,
        activities,
        invoices,
        totals,
        qualityChecks,
      }),
    [activities, caseRow, invoices, qualityChecks, totals],
  );
  const dossierInput = useMemo<CaseDossierInput>(
    () =>
      buildDossierInput({
        caseRow,
        activities,
        invoices,
        history,
        transfers,
        principalName,
        clientName,
        counterpartyName,
      }),
    [
      activities,
      caseRow,
      clientName,
      counterpartyName,
      history,
      invoices,
      principalName,
      transfers,
    ],
  );
  const caseActivityContext = useMemo(
    () => ({
      id: caseRow.id,
      principal_id: caseRow.principal_id,
      client_id: caseRow.client_id,
      counterparty_id: caseRow.counterparty_id,
      practice_number: caseRow.practice_number,
      principals: caseRow.principals,
      clients: caseRow.clients,
      counterparties: caseRow.counterparties,
    }),
    [caseRow],
  );

  const downloadDossier = () => {
    if (dossierDownloadsDisabled) return;
    downloadBytes(buildCaseDossierWorkbook(dossierInput));
  };

  const downloadPdfDossier = async () => {
    if (dossierDownloadsDisabled) return;
    const { downloadCaseDossierPdf } = await import("@/lib/case-dossier-pdf");
    downloadCaseDossierPdf(dossierInput);
  };

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Azioni rapide pratica</CardTitle>
          <CardDescription>
            Comandi operativi per continuare il lavoro sulla pratica.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <CaseActivityDialog
            caseRow={caseActivityContext}
            trigger={
              <Button size="sm">
                <Plus className="mr-1 size-4" />
                Nuova attività
              </Button>
            }
          />
          <Button asChild size="sm" variant="outline">
            <Link to="/fatture/nuova">
              <Receipt className="mr-1 size-4" />
              Nuova fattura
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/creazione-guidata">
              <Upload className="mr-1 size-4" />
              Creazione guidata
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadDossier}
            disabled={dossierDownloadsDisabled}
          >
            <FileSpreadsheet className="mr-1 size-4" />
            Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void downloadPdfDossier()}
            disabled={dossierDownloadsDisabled}
          >
            <FileText className="mr-1 size-4" />
            PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Cruscotto pratica</CardTitle>
              <CardDescription>
                Stato operativo, soggetti e prossima azione consigliata.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadDossier}
              disabled={dossierDownloadsDisabled}
            >
              <Download className="mr-1 size-4" />
              Dossier Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryTile
              label="Da fatturare"
              value={formatCurrency(totals.toInvoice)}
              tone="gold"
            />
            <SummaryTile label="Fatture collegate" value={String(invoices.length)} />
            <SummaryTile label="Allegati attività" value={String(totals.attachments)} />
            <SummaryTile label="Totale fatture" value={formatCurrency(totals.invoiceTotal)} />
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-3">
            <SubjectTile label="Committente" value={principalName} />
            <SubjectTile label="Cliente" value={clientName} />
            <SubjectTile label="Controparte" value={counterpartyName} />
          </div>

          <Separator />

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Workflow recupero crediti</p>
              </div>
              <WorkflowPriorityBadge workflow={workflow} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <WorkflowField label="Stato operativo" value={workflow.stage} />
              <WorkflowField label="Prossima azione" value={workflow.action} />
              <WorkflowField label="Motivo" value={workflow.reason} />
            </div>
            <p className="text-sm text-muted-foreground">{nextAction}</p>
          </div>
        </CardContent>
      </Card>

      {afterDashboardSlot}

      {detailsSlot ? renderCaseDetailsSection(detailsSlot) : null}

      <CaseTimeline
        timeline={timeline}
        isLoading={isLoading}
        onEditActivity={(activityId) => {
          const activity = activities.find((item) => item.id === activityId);
          if (activity) setEditingActivity(activity);
        }}
      />
      {editingActivity ? (
        <CaseActivityDialog
          caseRow={caseActivityContext}
          activity={editingActivity}
          open={Boolean(editingActivity)}
          trigger={null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingActivity(null);
          }}
        />
      ) : null}

      <CaseOperationsSummary totals={totals} qualityChecks={qualityChecks} />
    </div>
  );
}

function renderCaseDetailsSection(children: ReactNode) {
  return (
    <section className="space-y-4">
      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Dati e riferimenti pratica</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Modifica soggetti, stato, autorità, R.G. e note.
        </p>
      </div>
      {children}
    </section>
  );
}

function useCaseActivities(caseId: string) {
  return useQuery({
    queryKey: ["case-activities", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activities")
        .select("*, case_activity_hearings(*), activity_attachments(*)")
        .eq("case_id", caseId)
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OperationsActivityRow[];
    },
  });
}

function useCaseInvoices(caseId: string) {
  return useQuery({
    queryKey: ["case-invoices", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, year, issue_date, due_date, paid_at, status, total_amount, notes")
        .eq("case_id", caseId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
  });
}

function useCaseHistory(caseId: string) {
  return useQuery({
    queryKey: ["case-history", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_status_history")
        .select("*")
        .eq("case_id", caseId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });
}

function useCaseTransfers(caseId: string) {
  return useQuery({
    queryKey: ["case-credit-transfers", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_credit_transfers")
        .select(
          "id, transferred_at, previous_client:clients!case_credit_transfers_previous_client_owner_fkey(kind, first_name, last_name, business_name), new_client:clients!case_credit_transfers_new_client_owner_fkey(kind, first_name, last_name, business_name)",
        )
        .eq("case_id", caseId)
        .order("transferred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TransferRow[];
    },
  });
}

function getNextAction({
  activities,
  invoices,
  attachmentCount,
}: {
  activities: ActivityRow[];
  invoices: InvoiceRow[];
  attachmentCount: number;
}) {
  const toInvoice = activities.filter((activity) => activity.status === "to_invoice");
  if (activities.length === 0) return "Registra la prima Attività fatturabile della pratica.";
  if (toInvoice.length > 0)
    return "Controlla le Attività da fatturare e prepara la prossima Fattura.";
  if (invoices.some((invoice) => invoice.status === "draft")) {
    return "Completa o emetti le Fatture ancora in bozza.";
  }
  if (attachmentCount === 0)
    return "Aggiungi gli allegati essenziali alle Attività già registrate.";
  return "Scarica il dossier quando devi condividere o archiviare il riepilogo della pratica.";
}

function buildDossierInput({
  caseRow,
  activities,
  invoices,
  history,
  transfers,
  principalName,
  clientName,
  counterpartyName,
}: {
  caseRow: CaseOperationsCase;
  activities: ActivityRow[];
  invoices: InvoiceRow[];
  history: HistoryRow[];
  transfers: TransferRow[];
  principalName: string;
  clientName: string;
  counterpartyName: string;
}): CaseDossierInput {
  return {
    practiceNumber: caseRow.practice_number,
    title: practiceDisplayName(caseRow),
    status: caseStatusLabels[caseRow.status] ?? caseRow.status,
    openedAt: caseRow.opened_at,
    closedAt: caseRow.closed_at,
    principalName,
    clientName,
    counterpartyName,
    authority: caseRow.authority,
    rgNumber: caseRow.rg_number,
    notes: caseRow.notes,
    activities: activities.map((activity) => ({
      activityDate: activity.activity_date,
      kind: priceItemKindLabels[activity.kind] ?? activity.kind,
      status: caseActivityStatusLabels[activity.status] ?? activity.status,
      needsReview: activity.needs_review,
      description: activity.description,
      quantity: Number(activity.quantity) || 0,
      unitPrice: Number(activity.unit_price) || 0,
      amount: Number(activity.amount) || 0,
      hearingDates: sortedHearings(activity).map((hearing) => hearing.hearing_date),
      attachmentNames: (activity.activity_attachments ?? []).map(
        (attachment) => attachment.display_name,
      ),
      notes: activity.notes,
    })),
    invoices: invoices.map((invoice) => ({
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      number: invoice.number,
      year: invoice.year,
      status: invoiceStatusLabels[invoice.status] ?? invoice.status,
      totalAmount: Number(invoice.total_amount) || 0,
      notes: invoice.notes,
    })),
    history: history.map((item) => ({
      changedAt: item.changed_at,
      previousStatus: item.previous_status
        ? (caseStatusLabels[item.previous_status] ?? item.previous_status)
        : null,
      newStatus: caseStatusLabels[item.new_status] ?? item.new_status,
      note: item.note,
    })),
    transfers: transfers.map((transfer) => ({
      transferredAt: transfer.transferred_at,
      previousClientName: transfer.previous_client
        ? clientDisplayName(transfer.previous_client as ClientDisplayData)
        : "-",
      newClientName: transfer.new_client
        ? clientDisplayName(transfer.new_client as ClientDisplayData)
        : "-",
    })),
  };
}
