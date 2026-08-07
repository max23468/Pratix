import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SetInvoiceIssueStateInput = {
  invoiceId: string;
  issued: boolean;
};

function validateSetInvoiceIssueStateInput(input: Partial<SetInvoiceIssueStateInput> | undefined) {
  if (!input?.invoiceId || typeof input.invoiceId !== "string") {
    throw new Error("Fattura non valida");
  }
  if (typeof input.issued !== "boolean") {
    throw new Error("Stato fattura non valido");
  }
  return { invoiceId: input.invoiceId, issued: input.issued };
}

export const setInvoiceIssueStateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateSetInvoiceIssueStateInput)
  .handler(async ({ data, context }) => {
    const { data: invoiceId, error } = await context.supabase.rpc("set_invoice_issue_state", {
      p_invoice_id: data.invoiceId,
      p_issued: data.issued,
    });
    if (error) throw error;
    if (!invoiceId) {
      throw new Error(
        data.issued
          ? "Solo le fatture in bozza possono essere emesse"
          : "Solo le fatture emesse possono tornare in bozza",
      );
    }
    return { invoiceId };
  });
