import type { Database } from "@/integrations/supabase/types";

export type PriceItemKind = Database["public"]["Enums"]["price_item_kind"];
export type PriceBookStatus = Database["public"]["Enums"]["price_book_status"];

export type PriceTemplateItem = {
  kind: PriceItemKind;
  code: string;
  name: string;
  invoice_description: string | null;
  unit_price: number | null;
  requires_hearing_dates: boolean;
  sort_order: number;
};

export const commonPriceTemplateYears = [2025, 2026] as const;

export const commonPriceTemplateItems: PriceTemplateItem[] = [
  {
    kind: "fee",
    code: "COMP_DI_CARTACEO",
    name: "Procedura cartacea / Decreto ingiuntivo",
    invoice_description: "Procedura cartacea / Decreto ingiuntivo",
    unit_price: 80,
    requires_hearing_dates: false,
    sort_order: 10,
  },
  {
    kind: "fee",
    code: "COMP_DI_TELEMATICO",
    name: "Procedura telematica / Decreto ingiuntivo",
    invoice_description: "Procedura telematica / Decreto ingiuntivo",
    unit_price: 40,
    requires_hearing_dates: false,
    sort_order: 20,
  },
  {
    kind: "fee",
    code: "COMP_PRECETTO",
    name: "Precetto",
    invoice_description: "Precetto",
    unit_price: 25,
    requires_hearing_dates: false,
    sort_order: 30,
  },
  {
    kind: "fee",
    code: "COMP_PIGN_MOB_TERZI_RUOLO",
    name: "Pignoramento mobiliare presso terzi, con iscrizione a ruolo",
    invoice_description: "Pignoramento mobiliare presso terzi, con iscrizione a ruolo",
    unit_price: 90,
    requires_hearing_dates: false,
    sort_order: 40,
  },
  {
    kind: "fee",
    code: "COMP_PIGN_MOB_TERZI_NO_RUOLO",
    name: "Pignoramento mobiliare presso terzi, senza iscrizione a ruolo",
    invoice_description: "Pignoramento mobiliare presso terzi, senza iscrizione a ruolo",
    unit_price: 60,
    requires_hearing_dates: false,
    sort_order: 50,
  },
  {
    kind: "fee",
    code: "COMP_PIGN_IMM_569",
    name: "Pignoramento immobiliare diretto, attività fino all'udienza ex art. 569 c.p.c.",
    invoice_description:
      "Pignoramento immobiliare diretto, attività fino all'udienza ex art. 569 c.p.c.",
    unit_price: 150,
    requires_hearing_dates: false,
    sort_order: 60,
  },
  {
    kind: "fee",
    code: "COMP_PIGN_IMM_12_MESI_569",
    name: "Pignoramento immobiliare diretto, decorrenza 12 mesi dall'udienza ex art. 569 c.p.c.",
    invoice_description:
      "Pignoramento immobiliare diretto, decorrenza 12 mesi dall'udienza ex art. 569 c.p.c.",
    unit_price: 150,
    requires_hearing_dates: false,
    sort_order: 70,
  },
  {
    kind: "fee",
    code: "COMP_PIGN_IMM_DISTRIBUZIONE",
    name: "Pignoramento immobiliare diretto, distribuzione somme",
    invoice_description: "Pignoramento immobiliare diretto, distribuzione somme",
    unit_price: 150,
    requires_hearing_dates: false,
    sort_order: 80,
  },
  {
    kind: "fee",
    code: "COMP_INTERVENTO_IMM_DEPOSITO",
    name: "Intervento in procedura esecutiva immobiliare, deposito intervento",
    invoice_description: "Intervento in procedura esecutiva immobiliare, deposito intervento",
    unit_price: 100,
    requires_hearing_dates: false,
    sort_order: 90,
  },
  {
    kind: "fee",
    code: "COMP_INTERVENTO_IMM_12_MESI",
    name: "Intervento in procedura esecutiva immobiliare, decorrenza 12 mesi dal deposito",
    invoice_description:
      "Intervento in procedura esecutiva immobiliare, decorrenza 12 mesi dal deposito",
    unit_price: 100,
    requires_hearing_dates: false,
    sort_order: 100,
  },
  {
    kind: "fee",
    code: "COMP_INTERVENTO_IMM_DISTRIBUZIONE",
    name: "Intervento in procedura esecutiva immobiliare, distribuzione somme",
    invoice_description: "Intervento in procedura esecutiva immobiliare, distribuzione somme",
    unit_price: 100,
    requires_hearing_dates: false,
    sort_order: 110,
  },
  {
    kind: "fee",
    code: "COMP_ACCESSO_CANCELLERIA",
    name: "Accesso in cancelleria o richiesta notificazione non inclusa in altre fasi",
    invoice_description:
      "Accesso in cancelleria o richiesta notificazione non inclusa in altre fasi",
    unit_price: 25,
    requires_hearing_dates: false,
    sort_order: 120,
  },
  {
    kind: "fee",
    code: "COMP_UDIENZA_PROCEDIMENTI",
    name: "Procedimenti ordinari, mediazione, esecutivi, concorsuali: udienza sostenuta",
    invoice_description:
      "Procedimenti ordinari, mediazione, esecutivi, concorsuali: udienza sostenuta",
    unit_price: 40,
    requires_hearing_dates: true,
    sort_order: 130,
  },
  {
    kind: "fee",
    code: "COMP_VENDITA_NO_AGGIUDICAZIONE",
    name: "Partecipazione vendita senza aggiudicazione",
    invoice_description: "Partecipazione vendita senza aggiudicazione",
    unit_price: 100,
    requires_hearing_dates: false,
    sort_order: 140,
  },
  {
    kind: "fee",
    code: "COMP_VENDITA_AGGIUDICAZIONE_POSSESSO",
    name: "Partecipazione vendita con aggiudicazione e immissione nel possesso",
    invoice_description: "Partecipazione vendita con aggiudicazione e immissione nel possesso",
    unit_price: 200,
    requires_hearing_dates: false,
    sort_order: 150,
  },
  {
    kind: "fee",
    code: "COMP_VENDITE_CONTESTUALI_IPOTECHE",
    name: "Partecipazione a vendite contestuali / incontri per assenso cancellazione ipoteche",
    invoice_description:
      "Partecipazione a vendite contestuali / incontri per assenso cancellazione ipoteche",
    unit_price: 170,
    requires_hearing_dates: false,
    sort_order: 160,
  },
  {
    kind: "expense_reimbursement",
    code: "RIMB_NOTIFICA",
    name: "Costo notifica",
    invoice_description: "Costo notifica",
    unit_price: null,
    requires_hearing_dates: false,
    sort_order: 210,
  },
  {
    kind: "expense_reimbursement",
    code: "RIMB_NOTIFICA_PRECETTO",
    name: "Costo notifica precetto",
    invoice_description: "Costo notifica precetto",
    unit_price: null,
    requires_hearing_dates: false,
    sort_order: 220,
  },
  {
    kind: "expense_reimbursement",
    code: "RIMB_PIGNORAMENTO",
    name: "Costo pignoramento",
    invoice_description: "Costo pignoramento",
    unit_price: null,
    requires_hearing_dates: false,
    sort_order: 230,
  },
  {
    kind: "expense_reimbursement",
    code: "RIMB_CONGUAGLIO",
    name: "Eventuale importo del conguaglio",
    invoice_description: "Eventuale importo del conguaglio",
    unit_price: null,
    requires_hearing_dates: false,
    sort_order: 240,
  },
  {
    kind: "expense_reimbursement",
    code: "RIMB_MARCHE_BOLLO",
    name: "Marche da bollo",
    invoice_description: "Marche da bollo",
    unit_price: null,
    requires_hearing_dates: false,
    sort_order: 250,
  },
  {
    kind: "expense_reimbursement",
    code: "RIMB_ALTRE_SPESE",
    name: "Altre spese, ad esempio spedizioni",
    invoice_description: "Altre spese, ad esempio spedizioni",
    unit_price: null,
    requires_hearing_dates: false,
    sort_order: 260,
  },
];

export const createTemplateItems = () =>
  commonPriceTemplateItems.map((item) => ({
    ...item,
    is_enabled: true,
  }));

export const defaultValidFrom = (year: number) => `${year}-01-01`;
export const defaultValidTo = (year: number) => `${year}-12-31`;
