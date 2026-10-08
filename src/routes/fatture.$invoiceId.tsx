import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { PageState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { downloadBytes } from "@/lib/file-downloads";
import type { InvoiceLineKind } from "@/lib/invoice-calc";
import { invoiceLineKindLabels } from "@/lib/invoice-calc";
import type { InvoicePdfData } from "@/lib/invoice-pdf";
import { getUnpaidInvoiceStatus } from "@/lib/invoice-status";
import { invoiceStatusLabels, invoiceStatusVariant } from "@/lib/labels";
import { publicCodeLookup } from "@/lib/public-route-code";
import { getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import { generateBillingExportFn, generateInvoiceXmlFn } from "@/server/invoices-export.functions";
import { setInvoiceIssueStateFn } from "@/server/invoices-issue.functions";

type GenerateInvoiceXmlResult = {
  xml: string;
  filename: string;
};

type GenerateBillingExportResult = {
  bytesBase64: string;
  fileName: string;
  mimeType: string;
};

type SetInvoiceIssueStateResult = {
  invoiceId: string;
};

const bytesFromBase64 = (value: string) => {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const Route = createFileRoute("/fatture/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Fattura · Pratix" },
      { name: "description", content: "Dettaglio fattura, PDF, XML SdI e rendiconti Excel." },
      { property: "og:title", content: "Fattura · Pratix" },
      {
        property: "og:description",
        content: "Dettaglio fattura, PDF, XML SdI e rendiconti Excel.",
      },
    ],
  }),
  component: InvoiceDetailPage,
});

function useInvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const generateInvoiceXml = useServerFn(generateInvoiceXmlFn);
  const generateBillingExport = useServerFn(generateBillingExportFn);
  const setInvoiceIssueState = useServerFn(setInvoiceIssueStateFn);
  const qc = useQueryClient();
  const [downloadingExportId, setDownloadingExportId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    enabled: !!user,
    queryFn: async () => {
      const lookup = publicCodeLookup(invoiceId);
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select("*")
        .eq(lookup.column, lookup.value)
        .single();
      if (error) throw error;
      const resolvedInvoiceId = invoice.id;

      const [
        { data: lines },
        { data: principal },
        { data: client },
        { data: profile },
        { data: exports },
      ] = await Promise.all([
        supabase
          .from("invoice_lines")
          .select("*")
          .eq("invoice_id", resolvedInvoiceId)
          .order("position", { ascending: true }),
        invoice.principal_id
          ? supabase.from("principals").select("*").eq("id", invoice.principal_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("clients").select("*").eq("id", invoice.client_id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", user!.id).single(),
        invoice.billing_run_id
          ? supabase
              .from("billing_exports")
              .select("*")
              .eq("billing_run_id", invoice.billing_run_id)
              .order("kind", { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);
      return {
        invoice,
        lines: lines || [],
        principal,
        client,
        profile,
        exports: exports || [],
      };
    },
  });

  const setIssuedState = async (issued: boolean) => {
    const resolvedInvoiceId = data?.invoice.id;
    if (!resolvedInvoiceId) throw new Error("Fattura non caricata");
    const result = await setInvoiceIssueState({
      data: { invoiceId: resolvedInvoiceId, issued },
      headers: await getAuthHeaders(),
    });
    return readServerResult<SetInvoiceIssueStateResult>(result);
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const resolvedInvoiceId = data?.invoice.id;
      if (!resolvedInvoiceId) throw new Error("Fattura non caricata");
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("id, billing_run_id")
        .eq("id", resolvedInvoiceId)
        .single();
      if (invoiceError) throw invoiceError;

      const { error: activityError } = await supabase
        .from("case_activities")
        .update({ status: "to_invoice", invoice_id: null })
        .eq("invoice_id", resolvedInvoiceId);
      if (activityError) throw activityError;

      if (invoice.billing_run_id) {
        const { data: exports } = await supabase
          .from("billing_exports")
          .select("storage_path")
          .eq("billing_run_id", invoice.billing_run_id);
        const paths = (exports ?? []).map((item) => item.storage_path);
        if (paths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from(PRATIX_DOCUMENTS_BUCKET)
            .remove(paths);
          if (storageError) throw storageError;
        }
        const { error: runError } = await supabase
          .from("billing_runs")
          .update({ status: "cancelled", invoice_id: null })
          .eq("id", invoice.billing_run_id);
        if (runError) throw runError;
      }

      const { error } = await supabase.from("invoices").delete().eq("id", resolvedInvoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fattura eliminata e attività riaperte");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      navigate({ to: "/fatture" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      const resolvedInvoiceId = data?.invoice.id;
      if (!resolvedInvoiceId) throw new Error("Fattura non caricata");
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10) })
        .eq("id", resolvedInvoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fattura segnata come pagata");
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unmarkPaidMutation = useMutation({
    mutationFn: async () => {
      const resolvedInvoiceId = data?.invoice.id;
      if (!resolvedInvoiceId) throw new Error("Fattura non caricata");
      const unpaidStatus = getUnpaidInvoiceStatus(data?.invoice.due_date);
      const { data: updatedInvoice, error } = await supabase
        .from("invoices")
        .update({ status: unpaidStatus, paid_at: null })
        .eq("id", resolvedInvoiceId)
        .eq("status", "paid")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updatedInvoice) throw new Error("Solo le fatture pagate possono tornare emesse");
    },
    onSuccess: () => {
      toast.success("Pagamento annullato");
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markIssuedMutation = useMutation({
    mutationFn: async () => {
      await setIssuedState(true);
    },
    onSuccess: () => {
      toast.success("Fattura segnata come emessa");
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["case-activities"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unmarkIssuedMutation = useMutation({
    mutationFn: async () => {
      await setIssuedState(false);
    },
    onSuccess: () => {
      toast.success("Fattura riportata in bozza");
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["case-activities"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const downloadXmlMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessione non valida. Accedi di nuovo.");
      const resolvedInvoiceId = data?.invoice.id;
      if (!resolvedInvoiceId) throw new Error("Fattura non caricata");
      const result = await generateInvoiceXml({
        data: { invoiceId: resolvedInvoiceId },
        headers: { Authorization: `Bearer ${token}` },
      });
      return readServerResult<GenerateInvoiceXmlResult>(result);
    },
    onSuccess: (payload) => {
      const blob = new Blob([payload.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("XML SdI scaricato");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDownloadPdf = async () => {
    if (!data) return;
    const { downloadInvoicePdf } = await import("@/lib/invoice-pdf");
    const billedParty = data.principal
      ? {
          kind: "company",
          business_name: data.principal.business_name,
          first_name: null,
          last_name: null,
          tax_code: data.principal.tax_code,
          vat_number: data.principal.vat_number,
          address_street: data.principal.address_street,
          address_zip: data.principal.address_zip,
          address_city: data.principal.address_city,
          address_province: data.principal.address_province,
        }
      : data.client;

    downloadInvoicePdf({
      invoice: {
        number: data.invoice.number,
        year: data.invoice.year,
        issue_date: data.invoice.issue_date,
        due_date: data.invoice.due_date,
        notes: data.invoice.notes,
        taxable_fees: Number(data.invoice.taxable_fees),
        art15_expenses: Number(data.invoice.art15_expenses),
        general_expenses_amount: Number(data.invoice.general_expenses_amount),
        cassa_amount: Number(data.invoice.cassa_amount),
        vat_amount: Number(data.invoice.vat_amount),
        withholding_amount: Number(data.invoice.withholding_amount),
        stamp_amount: Number(data.invoice.stamp_amount),
        total_amount: Number(data.invoice.total_amount),
        net_to_pay: Number(data.invoice.net_to_pay),
        cassa_rate: Number(data.invoice.cassa_rate),
        vat_rate: Number(data.invoice.vat_rate),
        withholding_rate: Number(data.invoice.withholding_rate),
        apply_withholding: data.invoice.apply_withholding,
      },
      lines: data.lines.map((line) => ({
        kind: line.kind as InvoiceLineKind,
        description: line.description,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        amount: Number(line.amount),
      })),
      client: billedParty as InvoicePdfData["client"],
      profile: data.profile as InvoicePdfData["profile"],
    });
  };

  const downloadExport = async (exportId: string, kind: "fees" | "expenses") => {
    setDownloadingExportId(exportId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessione non valida. Accedi di nuovo.");
      const resolvedInvoiceId = data?.invoice.id;
      if (!resolvedInvoiceId) throw new Error("Fattura non caricata");

      const result = await generateBillingExport({
        data: { invoiceId: resolvedInvoiceId, kind },
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await readServerResult<GenerateBillingExportResult>(result);

      downloadBytes({
        bytes: bytesFromBase64(payload.bytesBase64),
        fileName: payload.fileName,
        mimeType: payload.mimeType || XLSX_MIME_TYPE,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download rendiconto non riuscito");
    } finally {
      setDownloadingExportId(null);
    }
  };

  return {
    data,
    isLoading,
    downloadingExportId,
    deleteMutation,
    markPaidMutation,
    unmarkPaidMutation,
    markIssuedMutation,
    unmarkIssuedMutation,
    downloadXmlMutation,
    handleDownloadPdf,
    downloadExport,
  };
}

type InvoiceDetailData = NonNullable<ReturnType<typeof useInvoiceDetailPage>["data"]>;
type InvoiceRecord = InvoiceDetailData["invoice"];
type ActionMutation = { mutate: () => void; isPending: boolean };

function invoiceCapabilities(status: string) {
  const isOpen = status === "issued" || status === "overdue";
  return {
    canEditDraft: status === "draft",
    canMarkIssued: status === "draft",
    canUnmarkIssued: isOpen,
    canMarkPaid: isOpen,
    canUnmarkPaid: status === "paid",
  };
}

function InvoiceLinesCard({ lines }: { lines: InvoiceDetailData["lines"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Righe fattura</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Pratica</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Controparte</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-right">Q.tà</TableHead>
              <TableHead className="text-right">Prezzo</TableHead>
              <TableHead className="text-right">Totale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <InvoiceLineRow key={line.id} line={line} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvoiceLineRow({ line }: { line: InvoiceDetailData["lines"][number] }) {
  return (
    <TableRow>
      <TableCell>{formatDate(line.activity_date)}</TableCell>
      <TableCell>{line.practice_number ? `N. ${line.practice_number}` : "—"}</TableCell>
      <TableCell>{line.client_name || "—"}</TableCell>
      <TableCell>{line.counterparty_name || "—"}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span>{line.description}</span>
          <span className="text-xs text-muted-foreground">
            {invoiceLineKindLabels[line.kind as InvoiceLineKind]}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">{Number(line.quantity)}</TableCell>
      <TableCell className="text-right">{formatCurrency(Number(line.unit_price))}</TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(Number(line.amount))}
      </TableCell>
    </TableRow>
  );
}

function InvoiceTotalsCard({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Totali</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant={invoiceStatusVariant[invoice.status] ?? "outline"}>
          {invoiceStatusLabels[invoice.status] ?? invoice.status}
        </Badge>
        <SummaryRow label="Data" value={formatDate(invoice.issue_date)} />
        <SummaryRow label="Compensi" value={formatCurrency(Number(invoice.taxable_fees))} />
        {Number(invoice.general_expenses_amount) > 0 && (
          <SummaryRow
            label="Spese generali"
            value={formatCurrency(Number(invoice.general_expenses_amount))}
          />
        )}
        <SummaryRow label="Cassa" value={formatCurrency(Number(invoice.cassa_amount))} />
        {Number(invoice.vat_amount) > 0 && (
          <SummaryRow label="IVA" value={formatCurrency(Number(invoice.vat_amount))} />
        )}
        <SummaryRow
          label="Rimborsi Art. 15"
          value={formatCurrency(Number(invoice.art15_expenses))}
        />
        <SummaryRow label="Totale" value={formatCurrency(Number(invoice.total_amount))} strong />
        <SummaryRow label="Netto" value={formatCurrency(Number(invoice.net_to_pay))} strong />
      </CardContent>
    </Card>
  );
}

function InvoiceActionButton({
  mutation,
  icon: Icon,
  children,
}: {
  mutation: ActionMutation;
  icon: typeof Send;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      className="w-full justify-start"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      <Icon className="mr-2 size-4" /> {children}
    </Button>
  );
}

function EditDraftButton({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <Button asChild className="w-full justify-start">
      <Link to="/fatture/nuova" search={{ bozza: invoice.public_code ?? invoice.id }}>
        <Pencil className="mr-2 size-4" /> Modifica bozza
      </Link>
    </Button>
  );
}

function DeleteInvoiceDialog({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full justify-start">
          <Trash2 className="mr-2 size-4" /> Elimina fattura
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare la fattura?</AlertDialogTitle>
          <AlertDialogDescription>
            Le attività collegate torneranno da fatturare e i rendiconti Excel verranno rimossi
            dallo storage.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Elimina
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function IssueStateActions({
  status,
  markIssuedMutation,
  unmarkIssuedMutation,
}: {
  status: string;
  markIssuedMutation: ActionMutation;
  unmarkIssuedMutation: ActionMutation;
}) {
  const { canMarkIssued, canUnmarkIssued } = invoiceCapabilities(status);
  return (
    <>
      {canMarkIssued && (
        <InvoiceActionButton mutation={markIssuedMutation} icon={Send}>
          Segna come emessa
        </InvoiceActionButton>
      )}
      {canUnmarkIssued && (
        <div className="space-y-1">
          <InvoiceActionButton mutation={unmarkIssuedMutation} icon={RotateCcw}>
            Riporta in bozza
          </InvoiceActionButton>
          <p className="text-xs text-muted-foreground">
            Le Attività restano collegate a questa fattura e non tornano da fatturare.
          </p>
        </div>
      )}
    </>
  );
}

function PaymentStateActions({
  status,
  markPaidMutation,
  unmarkPaidMutation,
}: {
  status: string;
  markPaidMutation: ActionMutation;
  unmarkPaidMutation: ActionMutation;
}) {
  const { canMarkPaid, canUnmarkPaid } = invoiceCapabilities(status);
  return (
    <>
      {canMarkPaid && (
        <InvoiceActionButton mutation={markPaidMutation} icon={CheckCircle2}>
          Segna come pagata
        </InvoiceActionButton>
      )}
      {canUnmarkPaid && (
        <InvoiceActionButton mutation={unmarkPaidMutation} icon={RotateCcw}>
          Annulla pagamento
        </InvoiceActionButton>
      )}
    </>
  );
}

type InvoiceMutations = Pick<
  ReturnType<typeof useInvoiceDetailPage>,
  | "deleteMutation"
  | "markPaidMutation"
  | "unmarkPaidMutation"
  | "markIssuedMutation"
  | "unmarkIssuedMutation"
>;

function InvoiceActionsCard({
  invoice,
  mutations,
}: {
  invoice: InvoiceRecord;
  mutations: InvoiceMutations;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Azioni</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {invoiceCapabilities(invoice.status).canEditDraft && <EditDraftButton invoice={invoice} />}
        <IssueStateActions
          status={invoice.status}
          markIssuedMutation={mutations.markIssuedMutation}
          unmarkIssuedMutation={mutations.unmarkIssuedMutation}
        />
        <PaymentStateActions
          status={invoice.status}
          markPaidMutation={mutations.markPaidMutation}
          unmarkPaidMutation={mutations.unmarkPaidMutation}
        />
        <DeleteInvoiceDialog onConfirm={() => mutations.deleteMutation.mutate()} />
      </CardContent>
    </Card>
  );
}

function ExportDownloadButton({
  item,
  isDownloading,
  onDownload,
}: {
  item: InvoiceDetailData["exports"][number];
  isDownloading: boolean;
  onDownload: (exportId: string, kind: "fees" | "expenses") => Promise<void>;
}) {
  const kind = item.kind === "fees" || item.kind === "expenses" ? item.kind : "fees";
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full min-w-0 justify-start overflow-hidden"
      disabled={isDownloading}
      onClick={() => void onDownload(item.id, kind)}
    >
      <FileSpreadsheet className="mr-2 size-4 shrink-0" />
      <span className="min-w-0 truncate text-left">
        {isDownloading ? "Preparazione download…" : item.file_name}
      </span>
    </Button>
  );
}

function InvoiceDocumentsCard({
  exports,
  downloadingExportId,
  downloadXmlMutation,
  onDownloadPdf,
  onDownloadExport,
}: {
  exports: InvoiceDetailData["exports"];
  downloadingExportId: string | null;
  downloadXmlMutation: ActionMutation;
  onDownloadPdf: () => void;
  onDownloadExport: (exportId: string, kind: "fees" | "expenses") => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documenti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <Button variant="outline" className="w-full justify-start" onClick={onDownloadPdf}>
            <FileText className="mr-2 size-4" /> PDF
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => downloadXmlMutation.mutate()}
            disabled={downloadXmlMutation.isPending}
          >
            <FileDown className="mr-2 size-4" />
            {downloadXmlMutation.isPending ? "Generazione…" : "XML SdI"}
          </Button>
        </div>
        {exports.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun rendiconto salvato.</p>
        )}
        {exports.map((item) => (
          <ExportDownloadButton
            key={item.id}
            item={item}
            isDownloading={downloadingExportId === item.id}
            onDownload={onDownloadExport}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function InvoiceDetailPage() {
  const { data, isLoading, downloadingExportId, handleDownloadPdf, downloadExport, ...mutations } =
    useInvoiceDetailPage();

  if (isLoading || !data) {
    return (
      <AppLayout>
        <PageState variant="loading" title="Caricamento fattura…" />
      </AppLayout>
    );
  }

  const billedName = data.principal?.business_name ?? data.client?.business_name ?? "—";

  return (
    <AppLayout>
      <PageHeader
        title={`Fattura ${data.invoice.number}/${data.invoice.year}`}
        description={`Committente: ${billedName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/fatture">
                <ArrowLeft className="mr-2 size-4" /> Torna alle fatture
              </Link>
            </Button>
            <Button asChild>
              <Link to="/fatture/nuova">
                <Plus className="mr-2 size-4" /> Nuova fattura
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <InvoiceLinesCard lines={data.lines} />

        <div className="space-y-4">
          <InvoiceTotalsCard invoice={data.invoice} />
          <InvoiceActionsCard invoice={data.invoice} mutations={mutations} />
          <InvoiceDocumentsCard
            exports={data.exports}
            downloadingExportId={downloadingExportId}
            downloadXmlMutation={mutations.downloadXmlMutation}
            onDownloadPdf={handleDownloadPdf}
            onDownloadExport={downloadExport}
          />
        </div>
      </div>
    </AppLayout>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-sm"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
