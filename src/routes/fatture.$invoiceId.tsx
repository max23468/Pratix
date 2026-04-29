import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileDown, FileText, Trash2, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { InvoiceForm } from "@/components/invoice-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { generateInvoiceXmlFn } from "@/server/invoices.functions";

export const Route = createFileRoute("/fatture/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Fattura — Pratix" },
      { name: "description", content: "Dettaglio fattura, PDF e XML SdI." },
      { property: "og:title", content: "Fattura — Pratix" },
      { property: "og:description", content: "Dettaglio fattura, PDF e XML SdI." },
    ],
  }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    enabled: !!user,
    queryFn: async () => {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();
      if (error) throw error;

      const [{ data: lines }, { data: client }, { data: profile }] = await Promise.all([
        supabase
          .from("invoice_lines")
          .select("*")
          .eq("invoice_id", invoiceId)
          .order("position", { ascending: true }),
        supabase.from("clients").select("*").eq("id", invoice.client_id).single(),
        supabase.from("profiles").select("*").eq("id", user!.id).single(),
      ]);
      return { invoice, lines: lines || [], client, profile };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fattura eliminata");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      navigate({ to: "/fatture" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10) })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fattura segnata come pagata");
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const downloadXmlMutation = useMutation({
    mutationFn: async () => generateInvoiceXmlFn({ data: { invoiceId } }),
    onSuccess: (result) => {
      const blob = new Blob([result.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("XML SdI scaricato");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDownloadPdf = () => {
    if (!data) return;
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
      lines: data.lines.map((l) => ({
        kind: l.kind as any,
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        amount: Number(l.amount),
      })),
      client: data.client as any,
      profile: data.profile as any,
    });
  };

  if (isLoading || !data) {
    return (
      <AppLayout>
        <PageHeader title="Fattura" description="Caricamento…" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={`Fattura ${data.invoice.number}/${data.invoice.year}`}
        description="Modifica dati, scarica PDF di cortesia o XML SdI."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/fatture">
                <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
              </Link>
            </Button>
            {data.invoice.status !== "paid" && (
              <Button
                variant="outline"
                onClick={() => markPaidMutation.mutate()}
                disabled={markPaidMutation.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Segna pagata
              </Button>
            )}
            <Button variant="outline" onClick={handleDownloadPdf}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Button
              onClick={() => downloadXmlMutation.mutate()}
              disabled={downloadXmlMutation.isPending}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {downloadXmlMutation.isPending ? "Generazione…" : "XML SdI"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" aria-label="Elimina fattura">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare la fattura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'operazione è irreversibile. Verranno rimosse anche tutte le righe associate.
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
          </div>
        }
      />

      <InvoiceForm
        invoiceId={invoiceId}
        initialInvoice={{
          id: data.invoice.id,
          client_id: data.invoice.client_id,
          case_id: data.invoice.case_id,
          number: data.invoice.number,
          year: data.invoice.year,
          issue_date: data.invoice.issue_date,
          due_date: data.invoice.due_date,
          status: data.invoice.status as any,
          cassa_rate: Number(data.invoice.cassa_rate),
          vat_rate: Number(data.invoice.vat_rate),
          withholding_rate: Number(data.invoice.withholding_rate),
          apply_withholding: data.invoice.apply_withholding,
          payment_method: data.invoice.payment_method,
          notes: data.invoice.notes,
          paid_at: data.invoice.paid_at,
        }}
        initialLines={data.lines.map((l) => ({
          id: l.id,
          kind: l.kind as any,
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
        }))}
      />
    </AppLayout>
  );
}
