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
import { downloadBytes } from "@/lib/invoice-file-exports";
import type { InvoiceLineKind } from "@/lib/invoice-calc";
import { invoiceLineKindLabels } from "@/lib/invoice-calc";
import type { InvoicePdfData } from "@/lib/invoice-pdf";
import { getUnpaidInvoiceStatus } from "@/lib/invoice-status";
import { invoiceStatusLabels, invoiceStatusVariant } from "@/lib/labels";
import { publicCodeLookup } from "@/lib/public-route-code";
import { getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import {
  generateBillingExportFn,
  generateInvoiceXmlFn,
  setInvoiceIssueStateFn,
} from "@/server/invoices.functions";

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

function InvoiceDetailPage() {
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
        taxable_expenses: Number(data.invoice.taxable_expenses),
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

  if (isLoading || !data) {
    return (
      <AppLayout>
        <PageHeader title="Fattura" description="Caricamento…" />
      </AppLayout>
    );
  }

  const billedName = data.principal?.business_name ?? data.client?.business_name ?? "—";
  const hasVatAmount = Number(data.invoice.vat_amount) > 0;
  const canEditDraft = data.invoice.status === "draft";
  const canMarkIssued = data.invoice.status === "draft";
  const canUnmarkIssued = data.invoice.status === "issued" || data.invoice.status === "overdue";
  const canMarkPaid = data.invoice.status === "issued" || data.invoice.status === "overdue";
  const canUnmarkPaid = data.invoice.status === "paid";

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
                {data.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{formatDate(line.activity_date)}</TableCell>
                    <TableCell>
                      {line.practice_number ? `N. ${line.practice_number}` : "—"}
                    </TableCell>
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
                    <TableCell className="text-right">
                      {formatCurrency(Number(line.unit_price))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(line.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Totali</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant={invoiceStatusVariant[data.invoice.status] ?? "outline"}>
                {invoiceStatusLabels[data.invoice.status] ?? data.invoice.status}
              </Badge>
              <SummaryRow label="Data" value={formatDate(data.invoice.issue_date)} />
              <SummaryRow
                label="Compensi"
                value={formatCurrency(Number(data.invoice.taxable_fees))}
              />
              {Number(data.invoice.general_expenses_amount) > 0 && (
                <SummaryRow
                  label="Spese generali"
                  value={formatCurrency(Number(data.invoice.general_expenses_amount))}
                />
              )}
              <SummaryRow label="Cassa" value={formatCurrency(Number(data.invoice.cassa_amount))} />
              {hasVatAmount && (
                <SummaryRow label="IVA" value={formatCurrency(Number(data.invoice.vat_amount))} />
              )}
              <SummaryRow
                label="Rimborsi Art. 15"
                value={formatCurrency(Number(data.invoice.art15_expenses))}
              />
              <SummaryRow
                label="Totale"
                value={formatCurrency(Number(data.invoice.total_amount))}
                strong
              />
              <SummaryRow
                label="Netto"
                value={formatCurrency(Number(data.invoice.net_to_pay))}
                strong
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Azioni</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {canEditDraft && (
                <Button asChild className="w-full justify-start">
                  <Link
                    to="/fatture/nuova"
                    search={{ bozza: data.invoice.public_code ?? data.invoice.id }}
                  >
                    <Pencil className="mr-2 size-4" /> Modifica bozza
                  </Link>
                </Button>
              )}
              {canMarkIssued && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => markIssuedMutation.mutate()}
                  disabled={markIssuedMutation.isPending}
                >
                  <Send className="mr-2 size-4" /> Segna come emessa
                </Button>
              )}
              {canUnmarkIssued && (
                <div className="space-y-1">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => unmarkIssuedMutation.mutate()}
                    disabled={unmarkIssuedMutation.isPending}
                  >
                    <RotateCcw className="mr-2 size-4" /> Riporta in bozza
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Le Attività restano collegate a questa fattura e non tornano da fatturare.
                  </p>
                </div>
              )}
              {canMarkPaid && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => markPaidMutation.mutate()}
                  disabled={markPaidMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 size-4" /> Segna come pagata
                </Button>
              )}
              {canUnmarkPaid && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => unmarkPaidMutation.mutate()}
                  disabled={unmarkPaidMutation.isPending}
                >
                  <RotateCcw className="mr-2 size-4" /> Annulla pagamento
                </Button>
              )}
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
                      Le attività collegate torneranno da fatturare e i rendiconti Excel verranno
                      rimossi dallo storage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documenti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDownloadPdf}
                >
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
              {data.exports.length === 0 && (
                <p className="text-sm text-muted-foreground">Nessun rendiconto salvato.</p>
              )}
              {data.exports.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant="outline"
                  className="w-full min-w-0 justify-start overflow-hidden"
                  disabled={downloadingExportId === item.id}
                  onClick={() =>
                    void downloadExport(
                      item.id,
                      item.kind === "fees" || item.kind === "expenses" ? item.kind : "fees",
                    )
                  }
                >
                  <FileSpreadsheet className="mr-2 size-4 shrink-0" />
                  <span className="min-w-0 truncate text-left">
                    {downloadingExportId === item.id ? "Preparazione download…" : item.file_name}
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>
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
