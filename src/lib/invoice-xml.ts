/** Generazione XML FatturaPA 1.2.2 (TD06 - Parcella avvocati). */

const escapeXml = (s: string | number | null | undefined): string => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const num = (n: number | null | undefined, decimals = 2): string => {
  const v = typeof n === "number" ? n : 0;
  return v.toFixed(decimals);
};

const cleanCountry = (c?: string | null): string => (c || "IT").toUpperCase().slice(0, 2);
const cleanZip = (z?: string | null): string => (z || "00000").replace(/\D/g, "").padEnd(5, "0").slice(0, 5);
const cleanProvince = (p?: string | null): string => (p || "").toUpperCase().slice(0, 2);

export type InvoiceXmlData = {
  invoice: {
    number: string;
    year: number;
    issue_date: string; // YYYY-MM-DD
    due_date: string | null;
    payment_method: string | null;
    cassa_rate: number;
    vat_rate: number;
    withholding_rate: number;
    apply_withholding: boolean;
    taxable_fees: number;
    taxable_expenses: number;
    art15_expenses: number;
    cassa_amount: number;
    vat_amount: number;
    withholding_amount: number;
    stamp_amount: number;
    total_amount: number;
  };
  lines: Array<{
    kind: "fee" | "expense_taxable" | "expense_art15";
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  client: {
    kind: string;
    first_name?: string | null;
    last_name?: string | null;
    business_name?: string | null;
    tax_code?: string | null;
    vat_number?: string | null;
    sdi_code?: string | null;
    pec?: string | null;
    address_street?: string | null;
    address_zip?: string | null;
    address_city?: string | null;
    address_province?: string | null;
    address_country?: string | null;
  };
  profile: {
    business_name?: string | null;
    full_name?: string | null;
    vat_number?: string | null;
    tax_code?: string | null;
    address_street?: string | null;
    address_zip?: string | null;
    address_city?: string | null;
    address_province?: string | null;
    address_country?: string | null;
    tax_regime?: string | null;
  };
};

export type XmlBuildResult = {
  xml: string;
  filename: string;
};

const regimeFiscale = (r?: string | null): string =>
  r === "forfettario" ? "RF19" : "RF01";

/** Codice "Natura" IVA da usare per regimi/righe non imponibili. */
const naturaForfettario = "N2.2"; // Operazioni non soggette - altri casi

/**
 * Genera XML conforme allo standard FatturaPA versione 1.2.2.
 * Tipo documento: TD06 (Parcella).
 */
export function buildInvoiceXml(data: InvoiceXmlData): XmlBuildResult {
  const isForfettario = data.profile.tax_regime === "forfettario";
  const cedentePiva = (data.profile.vat_number || "").replace(/\D/g, "");
  if (!cedentePiva) {
    throw new Error("Partita IVA mancante: configurala in Impostazioni.");
  }

  const cedenteName =
    data.profile.business_name || data.profile.full_name || "Studio Legale";

  // Cessionario
  const isCompany = data.client.kind === "company" && !!data.client.business_name;
  const cessionarioPiva = (data.client.vat_number || "").replace(/\D/g, "");
  const cessionarioCf = (data.client.tax_code || "").trim().toUpperCase();
  if (!cessionarioPiva && !cessionarioCf) {
    throw new Error("Cliente senza P.IVA né Codice Fiscale: impossibile generare l'XML SdI.");
  }
  const sdiRaw = (data.client.sdi_code || "").trim().toUpperCase();
  // Se cliente estero usa XXXXXXX, altrimenti default 0000000
  const codiceDestinatario = sdiRaw || "0000000";
  const pecDestinatario = (data.client.pec || "").trim();

  const progressivo = `${data.invoice.year}${data.invoice.number}`
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 10);

  const formatoTrasmissione = isCompany ? "FPR12" : "FPR12"; // privati/B2B

  // Riepilogo IVA
  const imponibileIvato = data.invoice.taxable_fees + data.invoice.taxable_expenses + data.invoice.cassa_amount;
  const aliquotaIva = isForfettario ? 0 : data.invoice.vat_rate;

  const riepilogoBlocks: string[] = [];
  if (imponibileIvato > 0) {
    riepilogoBlocks.push(`
      <DatiRiepilogo>
        <AliquotaIVA>${num(aliquotaIva)}</AliquotaIVA>
        ${isForfettario ? `<Natura>${naturaForfettario}</Natura>` : ""}
        <ImponibileImporto>${num(imponibileIvato)}</ImponibileImporto>
        <Imposta>${num(data.invoice.vat_amount)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
        ${isForfettario ? `<RiferimentoNormativo>Operazione non soggetta ai sensi dell'art. 1, commi 54-89, L. 190/2014</RiferimentoNormativo>` : ""}
      </DatiRiepilogo>`);
  }
  // Art. 15 - escluse art. 15 DPR 633/72
  if (data.invoice.art15_expenses > 0) {
    riepilogoBlocks.push(`
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N1</Natura>
        <ImponibileImporto>${num(data.invoice.art15_expenses)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
        <RiferimentoNormativo>Spese escluse ex art. 15 DPR 633/72</RiferimentoNormativo>
      </DatiRiepilogo>`);
  }

  // Righe
  let nLinea = 0;
  const dettaglioLinee = data.lines
    .map((l) => {
      nLinea++;
      const aliquota =
        l.kind === "expense_art15" ? 0 : isForfettario ? 0 : data.invoice.vat_rate;
      const naturaTag = (() => {
        if (l.kind === "expense_art15")
          return `<Natura>N1</Natura>`;
        if (isForfettario) return `<Natura>${naturaForfettario}</Natura>`;
        return "";
      })();
      return `
      <DettaglioLinee>
        <NumeroLinea>${nLinea}</NumeroLinea>
        <Descrizione>${escapeXml(l.description || "Prestazione professionale")}</Descrizione>
        <Quantita>${num(l.quantity, 2)}</Quantita>
        <PrezzoUnitario>${num(l.unit_price)}</PrezzoUnitario>
        <PrezzoTotale>${num(l.amount)}</PrezzoTotale>
        <AliquotaIVA>${num(aliquota)}</AliquotaIVA>
        ${naturaTag}
      </DettaglioLinee>`;
    })
    .join("");

  // Cassa Forense
  const cassaBlock =
    data.invoice.cassa_amount > 0
      ? `
      <DatiCassaPrevidenziale>
        <TipoCassa>TC07</TipoCassa>
        <AlCassa>${num(data.invoice.cassa_rate)}</AlCassa>
        <ImportoContributoCassa>${num(data.invoice.cassa_amount)}</ImportoContributoCassa>
        <ImponibileCassa>${num(data.invoice.taxable_fees + data.invoice.taxable_expenses)}</ImponibileCassa>
        <AliquotaIVA>${num(aliquotaIva)}</AliquotaIVA>
        ${isForfettario ? `<Natura>${naturaForfettario}</Natura>` : ""}
      </DatiCassaPrevidenziale>`
      : "";

  // Ritenuta
  const ritenutaBlock =
    data.invoice.withholding_amount > 0
      ? `
      <DatiRitenuta>
        <TipoRitenuta>RT01</TipoRitenuta>
        <ImportoRitenuta>${num(data.invoice.withholding_amount)}</ImportoRitenuta>
        <AliquotaRitenuta>${num(data.invoice.withholding_rate)}</AliquotaRitenuta>
        <CausalePagamento>A</CausalePagamento>
      </DatiRitenuta>`
      : "";

  // Bollo
  const bolloBlock =
    data.invoice.stamp_amount > 0
      ? `
      <DatiBollo>
        <BolloVirtuale>SI</BolloVirtuale>
        <ImportoBollo>${num(data.invoice.stamp_amount)}</ImportoBollo>
      </DatiBollo>`
      : "";

  // Pagamento
  const modPag = (() => {
    const m = (data.invoice.payment_method || "").toLowerCase();
    if (m.includes("bonif")) return "MP05";
    if (m.includes("conta")) return "MP01";
    if (m.includes("assegn")) return "MP02";
    return "MP05";
  })();

  const pagamentoBlock = `
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>${modPag}</ModalitaPagamento>
        ${data.invoice.due_date ? `<DataScadenzaPagamento>${data.invoice.due_date}</DataScadenzaPagamento>` : ""}
        <ImportoPagamento>${num(data.invoice.total_amount - data.invoice.withholding_amount)}</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>`;

  // Cessionario nome
  const cessionarioBlock = isCompany
    ? `<Anagrafica><Denominazione>${escapeXml(data.client.business_name)}</Denominazione></Anagrafica>`
    : `<Anagrafica><Nome>${escapeXml(data.client.first_name || "")}</Nome><Cognome>${escapeXml(data.client.last_name || "")}</Cognome></Anagrafica>`;

  const cessionarioIdFiscale = cessionarioPiva
    ? `<IdFiscaleIVA><IdPaese>${cleanCountry(data.client.address_country)}</IdPaese><IdCodice>${escapeXml(cessionarioPiva)}</IdCodice></IdFiscaleIVA>`
    : "";
  const cessionarioCfTag = cessionarioCf ? `<CodiceFiscale>${escapeXml(cessionarioCf)}</CodiceFiscale>` : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="${formatoTrasmissione}">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXml(cedentePiva)}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${escapeXml(progressivo)}</ProgressivoInvio>
      <FormatoTrasmissione>${formatoTrasmissione}</FormatoTrasmissione>
      <CodiceDestinatario>${escapeXml(codiceDestinatario)}</CodiceDestinatario>
      ${pecDestinatario && codiceDestinatario === "0000000" ? `<PECDestinatario>${escapeXml(pecDestinatario)}</PECDestinatario>` : ""}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXml(cedentePiva)}</IdCodice></IdFiscaleIVA>
        ${data.profile.tax_code ? `<CodiceFiscale>${escapeXml(data.profile.tax_code)}</CodiceFiscale>` : ""}
        <Anagrafica><Denominazione>${escapeXml(cedenteName)}</Denominazione></Anagrafica>
        <RegimeFiscale>${regimeFiscale(data.profile.tax_regime)}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(data.profile.address_street || "—")}</Indirizzo>
        <CAP>${cleanZip(data.profile.address_zip)}</CAP>
        <Comune>${escapeXml(data.profile.address_city || "—")}</Comune>
        ${data.profile.address_province ? `<Provincia>${cleanProvince(data.profile.address_province)}</Provincia>` : ""}
        <Nazione>${cleanCountry(data.profile.address_country)}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        ${cessionarioIdFiscale}
        ${cessionarioCfTag}
        ${cessionarioBlock}
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(data.client.address_street || "—")}</Indirizzo>
        <CAP>${cleanZip(data.client.address_zip)}</CAP>
        <Comune>${escapeXml(data.client.address_city || "—")}</Comune>
        ${data.client.address_province ? `<Provincia>${cleanProvince(data.client.address_province)}</Provincia>` : ""}
        <Nazione>${cleanCountry(data.client.address_country)}</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD06</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${data.invoice.issue_date}</Data>
        <Numero>${escapeXml(data.invoice.number)}</Numero>
        ${cassaBlock}
        ${ritenutaBlock}
        ${bolloBlock}
        <ImportoTotaleDocumento>${num(data.invoice.total_amount)}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      ${dettaglioLinee}
      ${riepilogoBlocks.join("")}
    </DatiBeniServizi>
    ${pagamentoBlock}
  </FatturaElettronicaBody>
</p:FatturaElettronica>`.trim();

  // Pulizia: collassa righe vuote multiple
  const cleaned = xml.replace(/\n\s*\n/g, "\n");

  const filename = `IT${cedentePiva}_${progressivo}.xml`;
  return { xml: cleaned, filename };
}
