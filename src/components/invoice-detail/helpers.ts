import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { generateInvoiceXmlFn, generateBillingExportFn } from "@/server/invoices-export.functions";
import { setInvoiceIssueStateFn } from "@/server/invoices-issue.functions";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { publicCodeLookup } from "@/lib/public-route-code";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeaders, readServerResult } from "@/lib/server-functions";
import {
  type SetInvoiceIssueStateResult,
  type GenerateInvoiceXmlResult,
  type GenerateBillingExportResult,
} from "@/components/invoice-detail/types";
import { PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import { toast } from "sonner";
import { getUnpaidInvoiceStatus } from "@/lib/invoice-status";
import { type InvoiceLineKind } from "@/lib/invoice-calc";
import { type InvoicePdfData } from "@/lib/invoice-pdf";
import { downloadBytes } from "@/lib/file-downloads";

export const bytesFromBase64 = (value: string) => {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function useInvoiceDetailPage(invoiceId: string) {
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

export function invoiceCapabilities(status: string) {
  const isOpen = status === "issued" || status === "overdue";
  return {
    canEditDraft: status === "draft",
    canMarkIssued: status === "draft",
    canUnmarkIssued: isOpen,
    canMarkPaid: isOpen,
    canUnmarkPaid: status === "paid",
  };
}
