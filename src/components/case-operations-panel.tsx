import { Link } from "@tanstack/react-router";
import { useMemo, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Flag,
  FileText,
  FileSpreadsheet,
  ListChecks,
  Paperclip,
  Plus,
  Receipt,
  Upload,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CaseActivityDialog } from "@/components/case-activities";
import { supabase } from "@/integrations/supabase/client";
import { buildCaseDossierWorkbook, type CaseDossierInput } from "@/lib/case-dossier-xlsx";
import {
  buildCaseTimelineItems,
  sortedHearings,
  type CaseTimelineActivity as ActivityRow,
  type CaseTimelineHistoryItem as HistoryRow,
  type CaseTimelineInvoice as InvoiceRow,
  type CaseTimelineItem,
  type CaseTimelineParty,
  type CaseTimelineTransfer as TransferRow,
} from "@/lib/case-timeline";
import { buildDebtCollectionWorkflow, summarizeCaseOperations } from "@/lib/case-workflow";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseActivityStatusLabels,
  caseStatusLabels,
  clientDisplayName,
  counterpartyDisplayName,
  invoiceStatusLabels,
  priceItemKindLabels,
  type ClientDisplayData,
  type CounterpartyDisplayData,
} from "@/lib/labels";

export type CaseOperationsCase = {
  id: string;
  principal_id: string | null;
  client_id: string | null;
  counterparty_id: string | null;
  practice_number: number;
  case_number?: string | null;
  title: string;
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

export function CaseOperationsPanel({ caseRow }: { caseRow: CaseOperationsCase }) {
  const { data: activities = [], isLoading: activitiesLoading } = useCaseActivities(caseRow.id);
  const { data: invoices = [], isLoading: invoicesLoading } = useCaseInvoices(caseRow.id);
  const { data: history = [], isLoading: historyLoading } = useCaseHistory(caseRow.id);
  const { data: transfers = [], isLoading: transfersLoading } = useCaseTransfers(caseRow.id);

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
    () => buildQualityChecks({ caseRow, activities, invoices, totals }),
    [activities, caseRow, invoices, totals],
  );
  const timeline = useMemo(
    () => buildCaseTimelineItems({ caseRow, activities, invoices, history, transfers }),
    [activities, caseRow, history, invoices, transfers],
  );
  const isLoading = activitiesLoading || invoicesLoading || historyLoading || transfersLoading;
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
      case_number: caseRow.case_number,
      title: caseRow.title,
      principals: caseRow.principals,
      clients: caseRow.clients,
      counterparties: caseRow.counterparties,
    }),
    [caseRow],
  );

  const downloadDossier = () => {
    if (dossierDownloadsDisabled) return;
    downloadFile(buildCaseDossierWorkbook(dossierInput));
  };

  const downloadPdfDossier = async () => {
    if (dossierDownloadsDisabled) return;
    const { downloadCaseDossierPdf } = await import("@/lib/case-dossier-pdf");
    downloadCaseDossierPdf(dossierInput);
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <OperationMetric label="Da fatturare" value={formatCurrency(totals.toInvoice)} />
        <OperationMetric label="Fatture collegate" value={String(invoices.length)} />
        <OperationMetric label="Allegati attività" value={String(totals.attachments)} />
        <OperationMetric label="Totale fatture" value={formatCurrency(totals.invoiceTotal)} />
      </div>

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
            <Link to="/import-archivio">
              <Upload className="mr-1 size-4" />
              Import archivio
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
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
                <Badge variant={workflow.priorityVariant}>{workflow.priority}</Badge>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dossier esportabile</CardTitle>
            <CardDescription>
              Excel e PDF con soggetti, attività, fatture, allegati e storico della pratica.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DossierLine icon={FileSpreadsheet} label="Formato dati" value="Excel .xlsx" />
            <DossierLine icon={FileText} label="Formato lettura" value="PDF" />
            <DossierLine icon={Receipt} label="Fatture" value={String(invoices.length)} />
            <DossierLine icon={Paperclip} label="Allegati" value={String(totals.attachments)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={downloadDossier} disabled={dossierDownloadsDisabled}>
                <Download className="mr-1 size-4" />
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void downloadPdfDossier()}
                disabled={dossierDownloadsDisabled}
              >
                <Download className="mr-1 size-4" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-2">
              <WalletCards className="mt-1 size-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Scheda economica</CardTitle>
                <CardDescription>
                  Compensi, rimborsi spese, fatturato, incassato e residuo operativo.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <EconomicLine label="Compensi" value={formatCurrency(totals.fees)} />
            <EconomicLine label="Rimborsi spese" value={formatCurrency(totals.reimbursements)} />
            <EconomicLine label="Maturato" value={formatCurrency(totals.matured)} />
            <EconomicLine label="Da fatturare" value={formatCurrency(totals.toInvoice)} />
            <EconomicLine label="Fatturato" value={formatCurrency(totals.invoiceTotal)} />
            <EconomicLine label="Incassato" value={formatCurrency(totals.paidTotal)} />
            <EconomicLine label="Residuo" value={formatCurrency(totals.residual)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Controlli qualità dati</CardTitle>
            <CardDescription>Avvisi sulle informazioni operative da completare.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {qualityChecks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-2 rounded-md border border-border p-3"
              >
                {check.severity === "ok" ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-muted-foreground" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{check.title}</p>
                  <p className="text-sm text-muted-foreground">{check.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <CaseTimeline timeline={timeline} isLoading={isLoading} />
    </div>
  );
}

export function CaseTimeline({
  timeline,
  isLoading,
}: {
  timeline: CaseTimelineItem[];
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline pratica</CardTitle>
        <CardDescription>
          Attività, allegati, fatture, cessioni credito e cambi di stato in ordine cronologico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun evento operativo registrato.</p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant="outline">{item.meta}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                    {item.amount ? (
                      <p className="text-sm font-medium">{formatCurrency(item.amount)}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
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
      return (data ?? []) as ActivityRow[];
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
    title: caseRow.title,
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

function buildQualityChecks({
  caseRow,
  activities,
  invoices,
  totals,
}: {
  caseRow: CaseOperationsCase;
  activities: ActivityRow[];
  invoices: InvoiceRow[];
  totals: ReturnType<typeof summarizeCaseOperations>;
}) {
  const checks: Array<{
    id: string;
    severity: "warning" | "ok";
    title: string;
    description: string;
  }> = [];

  if (!caseRow.principal_id) {
    checks.push({
      id: "missing-principal",
      severity: "warning",
      title: "Committente mancante",
      description: "Completa il soggetto fatturato prima di preparare nuove Fatture.",
    });
  }
  if (!caseRow.client_id) {
    checks.push({
      id: "missing-client",
      severity: "warning",
      title: "Cliente mancante",
      description: "Completa il Cliente per mantenere coerente la pratica.",
    });
  }
  if (!caseRow.counterparty_id) {
    checks.push({
      id: "missing-counterparty",
      severity: "warning",
      title: "Controparte mancante",
      description: "Aggiungi la Controparte per rendere completo il dossier.",
    });
  }
  if (activities.length === 0) {
    checks.push({
      id: "missing-activities",
      severity: "warning",
      title: "Nessuna Attività",
      description: "Registra almeno un Compenso o Rimborso spese se la pratica ha lavoro storico.",
    });
  }
  if (totals.toInvoice > 0) {
    checks.push({
      id: "to-invoice",
      severity: "warning",
      title: "Attività da fatturare",
      description: `${formatCurrency(totals.toInvoice)} non ancora collegati a una Fattura.`,
    });
  }
  if (totals.activitiesWithoutAttachments > 0) {
    checks.push({
      id: "missing-attachments",
      severity: "warning",
      title: "Attività senza allegati",
      description: `${totals.activitiesWithoutAttachments} Attività non hanno allegati collegati.`,
    });
  }
  const draftInvoices = invoices.filter((invoice) => invoice.status === "draft").length;
  if (draftInvoices > 0) {
    checks.push({
      id: "draft-invoices",
      severity: "warning",
      title: "Fatture in bozza",
      description: `${draftInvoices} Fatture sono ancora da completare o emettere.`,
    });
  }

  if (checks.length === 0) {
    checks.push({
      id: "ok",
      severity: "ok",
      title: "Dati principali completi",
      description: "La pratica non presenta avvisi operativi immediati.",
    });
  }

  return checks;
}

function OperationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SubjectTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function DossierLine({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function EconomicLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function WorkflowField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Flag className="size-3" />
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function downloadFile({
  bytes,
  fileName,
  mimeType,
}: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
