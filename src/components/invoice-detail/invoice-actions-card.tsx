import { useInvoiceDetailPage, invoiceCapabilities } from "@/components/invoice-detail/helpers";
import { type InvoiceRecord } from "@/components/invoice-detail/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EditDraftButton } from "@/components/invoice-detail/edit-draft-button";
import { IssueStateActions } from "@/components/invoice-detail/issue-state-actions";
import { PaymentStateActions } from "@/components/invoice-detail/payment-state-actions";
import { DeleteInvoiceDialog } from "@/components/invoice-detail/delete-invoice-dialog";

type InvoiceMutations = Pick<
  ReturnType<typeof useInvoiceDetailPage>,
  | "deleteMutation"
  | "markPaidMutation"
  | "unmarkPaidMutation"
  | "markIssuedMutation"
  | "unmarkIssuedMutation"
>;

export function InvoiceActionsCard({
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
