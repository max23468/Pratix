/** Server functions per fatture: numerazione e generazione XML SdI. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildInvoiceXml } from "@/lib/invoice-xml";

/** Restituisce e incrementa il prossimo numero fattura per l'anno corrente. */
export const reserveInvoiceNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const currentYear = new Date().getFullYear();

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("invoice_year, invoice_next_number, invoice_number_prefix")
      .eq("id", userId)
      .single();
    if (pErr) throw pErr;

    let year = profile?.invoice_year ?? currentYear;
    let next = profile?.invoice_next_number ?? 1;
    const prefix = profile?.invoice_number_prefix ?? "";

    if (year !== currentYear) {
      year = currentYear;
      next = 1;
    }

    const formatted = prefix ? `${prefix}${next}` : String(next);

    const { error: uErr } = await supabase
      .from("profiles")
      .update({ invoice_year: year, invoice_next_number: next + 1 })
      .eq("id", userId);
    if (uErr) throw uErr;

    return { number: formatted, year };
  });

/** Genera l'XML FatturaPA 1.2.2 per una fattura esistente. */
export const generateInvoiceXmlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string }) => {
    if (!input?.invoiceId || typeof input.invoiceId !== "string") {
      throw new Error("invoiceId mancante");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: invoice, error: iErr }, { data: profile, error: pErr }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .eq("id", data.invoiceId)
        .eq("user_id", userId)
        .single(),
      supabase.from("profiles").select("*").eq("id", userId).single(),
    ]);
    if (iErr) throw iErr;
    if (pErr) throw pErr;
    if (!invoice) throw new Error("Fattura non trovata");

    const [{ data: lines, error: lErr }, { data: client, error: cErr }] = await Promise.all([
      supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("position", { ascending: true }),
      supabase.from("clients").select("*").eq("id", invoice.client_id).single(),
    ]);
    if (lErr) throw lErr;
    if (cErr) throw cErr;
    if (!client) throw new Error("Cliente della fattura non trovato");

    const result = buildInvoiceXml({
      invoice: {
        number: invoice.number,
        year: invoice.year,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        payment_method: invoice.payment_method,
        cassa_rate: Number(invoice.cassa_rate),
        vat_rate: Number(invoice.vat_rate),
        withholding_rate: Number(invoice.withholding_rate),
        apply_withholding: invoice.apply_withholding,
        taxable_fees: Number(invoice.taxable_fees),
        taxable_expenses: Number(invoice.taxable_expenses),
        art15_expenses: Number(invoice.art15_expenses),
        cassa_amount: Number(invoice.cassa_amount),
        vat_amount: Number(invoice.vat_amount),
        withholding_amount: Number(invoice.withholding_amount),
        stamp_amount: Number(invoice.stamp_amount),
        total_amount: Number(invoice.total_amount),
      },
      lines: (lines || []).map((l) => ({
        kind: l.kind as "fee" | "expense_taxable" | "expense_art15",
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        amount: Number(l.amount),
      })),
      client: {
        kind: client.kind,
        first_name: client.first_name,
        last_name: client.last_name,
        business_name: client.business_name,
        tax_code: client.tax_code,
        vat_number: client.vat_number,
        sdi_code: client.sdi_code,
        pec: client.pec,
        address_street: client.address_street,
        address_zip: client.address_zip,
        address_city: client.address_city,
        address_province: client.address_province,
        address_country: client.address_country,
      },
      profile: {
        business_name: profile?.business_name,
        full_name: profile?.full_name,
        vat_number: profile?.vat_number,
        tax_code: profile?.tax_code,
        address_street: profile?.address_street,
        address_zip: profile?.address_zip,
        address_city: profile?.address_city,
        address_province: profile?.address_province,
        address_country: profile?.address_country,
        tax_regime: profile?.tax_regime,
      },
    });

    return result;
  });
