# Glossario di dominio

Termini legali, fiscali e di prodotto usati in Pratix. Pensato per chi lavora al codice senza essere avvocato o commercialista.

## Termini di prodotto

| Termine | Significato | Note |
|---|---|---|
| **Pratica** | Incarico professionale assegnato dal cliente. Sostituisce "caso". | Glossario di prodotto, vedi [tono-di-voce](./guides/tono-di-voce.md) |
| **Cliente** | Persona fisica o azienda che conferisce l'incarico. Sostituisce "assistito". | |
| **Scadenza** | Adempimento legato a una pratica con data limite. Sostituisce "deadline". | |
| **Spese** | Costi sostenuti per conto del cliente, anticipi inclusi. Sostituisce "costi". | |
| **Fattura** | Documento fiscale emesso al cliente. In Pratix sempre **parcella** (TD06). | |
| **Professione** | Termine generico per riferirsi al lavoro del professionista. Mai "studio". Preferito a "attività", che è ambigua (indica anche le voci di lavoro fatturabili). | |

## Fatturazione elettronica

| Termine | Significato |
|---|---|
| **FatturaPA** | Standard italiano XML per la fatturazione elettronica obbligatoria, gestito dal Sistema di Interscambio (SDI). |
| **SDI** (Sistema di Interscambio) | Hub dell'Agenzia delle Entrate che riceve, valida e instrada le fatture elettroniche. |
| **TD06** | Tipo documento "Parcella": usato per le prestazioni professionali degli avvocati. È il tipo che Pratix genera. |
| **PEC** | Posta Elettronica Certificata, indirizzo legale per ricevere comunicazioni ufficiali e fatture. |
| **Codice destinatario** | Codice di 7 caratteri identificativo del canale di ricezione SDI del cliente. Se assente si usa `0000000` con PEC. |
| **CedentePrestatore** | Chi emette la fattura (l'avvocato in Pratix). |
| **CessionarioCommittente** | Chi riceve la fattura (il cliente). |

## Regimi fiscali italiani per avvocati

| Termine | Significato |
|---|---|
| **Regime forfettario** | Regime agevolato sotto soglia di ricavi (oggi 85.000 €). Niente IVA in fattura, niente ritenuta d'acconto, imposta sostitutiva al 5% o 15%. |
| **Regime ordinario** | Regime standard: IVA al 22% applicata, ritenuta d'acconto del 20% se il cliente è sostituto d'imposta. |
| **Ritenuta d'acconto** | Trattenuta del 20% sull'imponibile, versata dal cliente all'erario. Si applica solo nel regime ordinario verso sostituti d'imposta (aziende, partite IVA, enti). |
| **Sostituto d'imposta** | Cliente obbligato a trattenere e versare la ritenuta (tipicamente azienda o ente). Le persone fisiche private non lo sono. |
| **Imposta sostitutiva** | Imposta che nel regime forfettario sostituisce IRPEF e addizionali. |

## Cassa Forense

| Termine | Significato |
|---|---|
| **Cassa Forense** | Ente di previdenza obbligatoria per gli avvocati italiani. |
| **Contributo integrativo (CPA)** | 4% applicato in fattura sull'imponibile, addebitato al cliente, versato alla Cassa Forense. Spesso indicato come "CPA 4%". |
| **Contributo soggettivo** | Contributo personale del professionista alla Cassa Forense, **non** in fattura. |

## Anagrafica

| Termine | Significato |
|---|---|
| **Partita IVA** | Identificativo fiscale, 11 cifre per le persone fisiche italiane. Obbligatoria per emettere fattura. |
| **Codice Fiscale** | Identificativo personale, 16 caratteri alfanumerici per le persone fisiche. |
| **Ordine degli Avvocati** | Albo professionale di iscrizione obbligatoria, su base territoriale (es. "Ordine degli Avvocati di Milano"). |
| **Ragione sociale** | Denominazione formale dell'attività; per il freelance coincide spesso col nome del titolare. In Pratix: "Ragione sociale / Denominazione". |

## Termini tecnici di prodotto

| Termine | Significato |
|---|---|
| **RLS** (Row-Level Security) | Meccanismo Postgres/Supabase che limita le righe visibili in base all'utente loggato. Vedi [database](./guides/database.md). |
| **Edge function** | Funzione serverless che gira al bordo della rete, usata per logica server-side (es. invio mail). |
| **Token semantico** | Variabile CSS che descrive un ruolo (es. `--background`) e non un colore (es. `#fff`). Vedi [tema](./guides/tema-e-design.md). |
