import { useInvoiceDetailPage } from "@/components/invoice-detail/helpers";

export type GenerateInvoiceXmlResult = {
  xml: string;
  filename: string;
};

export type GenerateBillingExportResult = {
  bytesBase64: string;
  fileName: string;
  mimeType: string;
};

export type SetInvoiceIssueStateResult = {
  invoiceId: string;
};

export type InvoiceDetailData = NonNullable<ReturnType<typeof useInvoiceDetailPage>["data"]>;

export type InvoiceRecord = InvoiceDetailData["invoice"];

export type ActionMutation = { mutate: () => void; isPending: boolean };
