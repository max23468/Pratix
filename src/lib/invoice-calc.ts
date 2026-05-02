/** Calcoli fiscali per fatture italiane (avvocati). */

export type InvoiceLineKind = "fee" | "expense_taxable" | "expense_art15";

export type InvoiceLineInput = {
  kind: InvoiceLineKind;
  description?: string;
  quantity: number;
  unit_price: number;
};

export type InvoiceCalcOptions = {
  /** Aliquota cassa forense (es. 4 = 4%). */
  cassaRate: number;
  /** Aliquota IVA (es. 22 = 22%). */
  vatRate: number;
  /** Aliquota ritenuta d'acconto (es. 20 = 20%). */
  withholdingRate: number;
  /** Applicare la ritenuta d'acconto. Tipicamente false in regime forfettario. */
  applyWithholding: boolean;
  /** Regime fiscale del cedente. In forfettario non si applicano IVA né cassa addebitata. */
  taxRegime?: "ordinario" | "forfettario";
};

export type InvoiceCalcResult = {
  taxableFees: number;
  taxableExpenses: number;
  art15Expenses: number;
  cassaAmount: number;
  vatBase: number;
  vatAmount: number;
  withholdingBase: number;
  withholdingAmount: number;
  stampAmount: number;
  totalAmount: number;
  netToPay: number;
};

/** Arrotondamento a 2 decimali (banker-safe per uso fiscale italiano). */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const lineAmount = (l: InvoiceLineInput): number =>
  round2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0));

/**
 * Calcola tutti i totali fiscali della fattura.
 *
 * Schema:
 *  - Imponibile compensi = somma righe `fee` + `expense_taxable`
 *  - Cassa = imponibile × cassaRate%   (solo regime ordinario)
 *  - IVA = (imponibile + cassa) × vatRate%   (solo regime ordinario)
 *  - Ritenuta = imponibile × withholdingRate%  (solo se applyWithholding e ordinario)
 *  - Spese Art. 15 = anticipazioni in nome e per conto (escluse IVA, escluse ritenuta)
 *  - Bollo €2 se Art. 15 > €77,47 oppure (in forfettario) se totale > €77,47
 *  - Totale = imponibile + cassa + IVA + Art.15 + bollo
 *  - Netto a pagare = totale − ritenuta
 */
export function computeInvoice(
  lines: InvoiceLineInput[],
  options: InvoiceCalcOptions,
): InvoiceCalcResult {
  const isForfettario = options.taxRegime === "forfettario";

  let taxableFees = 0;
  let taxableExpenses = 0;
  let art15Expenses = 0;

  for (const l of lines) {
    const amt = lineAmount(l);
    if (l.kind === "fee") taxableFees += amt;
    else if (l.kind === "expense_taxable") taxableExpenses += amt;
    else if (l.kind === "expense_art15") art15Expenses += amt;
  }

  taxableFees = round2(taxableFees);
  taxableExpenses = round2(taxableExpenses);
  art15Expenses = round2(art15Expenses);

  const taxableTotal = round2(taxableFees + taxableExpenses);

  const cassaAmount = isForfettario ? 0 : round2(taxableTotal * (options.cassaRate / 100));

  const vatBase = round2(taxableTotal + cassaAmount);
  const vatAmount = isForfettario ? 0 : round2(vatBase * (options.vatRate / 100));

  const withholdingBase = isForfettario ? 0 : taxableTotal;
  const withholdingAmount =
    !isForfettario && options.applyWithholding
      ? round2(withholdingBase * (options.withholdingRate / 100))
      : 0;

  // Bollo €2: su Art.15 > 77,47 oppure (forfettario) su totale > 77,47
  const stampThreshold = 77.47;
  const stampAmount = (() => {
    if (art15Expenses > stampThreshold) return 2;
    if (isForfettario && taxableTotal > stampThreshold) return 2;
    return 0;
  })();

  const totalAmount = round2(taxableTotal + cassaAmount + vatAmount + art15Expenses + stampAmount);
  const netToPay = round2(totalAmount - withholdingAmount);

  return {
    taxableFees,
    taxableExpenses,
    art15Expenses,
    cassaAmount,
    vatBase,
    vatAmount,
    withholdingBase,
    withholdingAmount,
    stampAmount,
    totalAmount,
    netToPay,
  };
}

export const invoiceLineKindLabels: Record<InvoiceLineKind, string> = {
  fee: "Compenso",
  expense_taxable: "Spesa imponibile",
  expense_art15: "Anticipazione (Art. 15)",
};
