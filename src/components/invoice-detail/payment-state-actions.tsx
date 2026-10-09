import { type ActionMutation } from "@/components/invoice-detail/types";
import { invoiceCapabilities } from "@/components/invoice-detail/helpers";
import { InvoiceActionButton } from "@/components/invoice-detail/invoice-action-button";
import { CheckCircle2, RotateCcw } from "lucide-react";

export function PaymentStateActions({
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
