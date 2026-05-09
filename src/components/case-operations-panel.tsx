import { useMemo, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, ListChecks, Paperclip, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { buildCaseDossierWorkbook } from "@/lib/case-dossier-xlsx";
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
  practice_number: number;
  title: string;
  status: string;
  opened_at: string;
  closed_at?: string | null;
  updated_at: string;
  authority?: string | null;
  rg_number?: string | null;
  notes?: string | null;
  principals?: { business_name?: string | null } | null;
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
  const timeline = useMemo(
    () => buildCaseTimelineItems({ caseRow, activities, invoices, history, transfers }),
    [activities, caseRow, history, invoices, transfers],
  );
  const isLoading = activitiesLoading || invoicesLoading || historyLoading || transfersLoading;

  const nextAction = getNextAction({ activities, invoices, attachmentCount: totals.attachments });

  const downloadDossier = () => {
    const workbook = buildCaseDossierWorkbook({
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
          : "—",
        newClientName: transfer.new_client
          ? clientDisplayName(transfer.new_client as ClientDisplayData)
          : "—",
      })),
    });

    downloadFile(workbook);
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <OperationMetric label="Da fatturare" value={formatCurrency(totals.toInvoice)} />
        <OperationMetric label="Fatture collegate" value={String(invoices.length)} />
        <OperationMetric label="Allegati attività" value={String(totals.attachments)} />
        <OperationMetric label="Totale fatture" value={formatCurrency(totals.invoiceTotal)} />
      </div>

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
              <Button type="button" variant="outline" size="sm" onClick={downloadDossier}>
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

            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <ListChecks className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Prossima azione</p>
              </div>
              <p className="text-sm text-muted-foreground">{nextAction}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dossier esportabile</CardTitle>
            <CardDescription>
              Excel con soggetti, attività, fatture, allegati e storico della pratica.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DossierLine icon={FileSpreadsheet} label="Formato" value="Excel .xlsx" />
            <DossierLine icon={Receipt} label="Fatture" value={String(invoices.length)} />
            <DossierLine icon={Paperclip} label="Allegati" value={String(totals.attachments)} />
            <Button type="button" className="w-full" onClick={downloadDossier} disabled={isLoading}>
              <Download className="mr-1 size-4" />
              Scarica dossier
            </Button>
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

function summarizeCaseOperations(activities: ActivityRow[], invoices: InvoiceRow[]) {
  return activities.reduce(
    (acc, activity) => {
      if (activity.status === "to_invoice") acc.toInvoice += Number(activity.amount) || 0;
      acc.attachments += activity.activity_attachments?.length ?? 0;
      return acc;
    },
    {
      toInvoice: 0,
      attachments: 0,
      invoiceTotal: invoices.reduce((sum, invoice) => sum + (Number(invoice.total_amount) || 0), 0),
    },
  );
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
