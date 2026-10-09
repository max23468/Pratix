import { type ActionMutation } from "@/components/invoice-detail/types";
import { invoiceCapabilities } from "@/components/invoice-detail/helpers";
import { InvoiceActionButton } from "@/components/invoice-detail/invoice-action-button";
import { Send, RotateCcw } from "lucide-react";

export function IssueStateActions({
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
