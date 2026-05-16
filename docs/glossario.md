# Glossario di dominio

Termini legali, fiscali e di prodotto usati in Pratix. Pensato per chi lavora al codice senza essere avvocato o commercialista.

## Termini di prodotto

| Termine                 | Significato                                                                                                                                                         | Note                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Committente**         | Società o ente a cui l'avvocato emette fattura. Nel recupero crediti ha uno o più clienti collegati.                                                                | Nuovo dominio recupero crediti, vedi [ADR 0013](./decisions/0013-focus-recupero-crediti.md)                                                                 |
| **Cliente**             | Soggetto collegato a uno o più committenti, spesso titolare del credito o società veicolo del portafoglio. Sostituisce "assistito".                                 |                                                                                                                                                             |
| **Controparte**         | Soggetto verso cui si svolge la pratica. Può essere persona, società o insieme di più soggetti con dati propri minimi e note.                                       |                                                                                                                                                             |
| **Pratica**             | Unità centrale di lavoro, data dall'incrocio tra committente, cliente e controparte. Sostituisce "caso".                                                            | Glossario di prodotto, vedi [tono-di-voce](./guides/tono-di-voce.md)                                                                                        |
| **Attività**            | Registrazione operativa e fatturabile collegata a una pratica: compenso/onorario o rimborso spese, con data, quantità/importo, stato, eventuali udienze e allegati. | Termine centrale nel nuovo dominio; esiste anche come sezione globale di inserimento rapido. Vedi [ADR 0014](./decisions/0014-attivita-termine-prodotto.md) |
| **Compenso / Onorario** | Attività imponibile con importo unitario definito dai prezzi annuali del committente. "Onorario" e "compenso" sono sinonimi.                                        | Totale = quantità x prezzo unitario                                                                                                                         |
| **Rimborso spese**      | Anticipazione Art. 15 ammessa dai prezzi del committente con importo inserito dall'avvocato e allegati facoltativi.                                                 | Non entra nella base della cassa forense                                                                                                                    |
| **Prezzi**              | Insieme annuale per committente delle voci di compenso/onorario e rimborso spese abilitate.                                                                         | Label principale in UI                                                                                                                                      |
| **Scadenza**            | Data limite o scadenza di pagamento. Il modulo scadenzario autonomo è stato rimosso dal perimetro recupero crediti.                                                 | Sostituisce "deadline"                                                                                                                                      |
| **Spese**               | Costi sostenuti per conto del cliente o del committente, anticipi inclusi. Sostituisce "costi".                                                                     |                                                                                                                                                             |
| **Fattura**             | Documento fiscale emesso al committente. In Pratix sempre **parcella** (TD06).                                                                                      |                                                                                                                                                             |
| **Rendiconto Excel**    | Allegato alla fattura compilato nel formato richiesto dal committente, distinto per onorari/compensi e rimborsi spese.                                              |                                                                                                                                                             |
| **Professione**         | Termine generico per riferirsi al lavoro del professionista.                                                                                                        |                                                                                                                                                             |

## Fatturazione elettronica

| Termine                           | Significato                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **FatturaPA**                     | Standard italiano XML per la fatturazione elettronica obbligatoria, gestito dal Sistema di Interscambio (SDI).         |
| **SDI** (Sistema di Interscambio) | Hub dell'Agenzia delle Entrate che riceve, valida e instrada le fatture elettroniche.                                  |
| **TD06**                          | Tipo documento "Parcella": usato per le prestazioni professionali degli avvocati. È il tipo che Pratix genera.         |
| **PEC**                           | Posta Elettronica Certificata, indirizzo legale per ricevere comunicazioni ufficiali e fatture.                        |
| **Codice destinatario**           | Codice di 7 caratteri identificativo del canale di ricezione SDI del committente. Se assente si usa `0000000` con PEC. |
| **CedentePrestatore**             | Chi emette la fattura (l'avvocato in Pratix).                                                                          |
| **CessionarioCommittente**        | Chi riceve la fattura (nel nuovo flusso Pratix, il committente).                                                       |

## Regimi fiscali italiani per avvocati

| Termine                 | Significato                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Regime forfettario**  | Regime agevolato sotto soglia di ricavi (oggi 85.000 €). Niente IVA in fattura, niente ritenuta d'acconto, imposta sostitutiva al 5% o 15%.                          |
| **Regime ordinario**    | Regime standard: IVA al 22% applicata, ritenuta d'acconto del 20% se il committente è sostituto d'imposta.                                                           |
| **Ritenuta d'acconto**  | Trattenuta del 20% sull'imponibile, versata dal committente all'erario. Si applica solo nel regime ordinario verso sostituti d'imposta (aziende, partite IVA, enti). |
| **Sostituto d'imposta** | Committente obbligato a trattenere e versare la ritenuta (tipicamente azienda o ente). Le persone fisiche private non lo sono.                                       |
| **Imposta sostitutiva** | Imposta che nel regime forfettario sostituisce IRPEF e addizionali.                                                                                                  |

## Cassa Forense

| Termine                          | Significato                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Cassa Forense**                | Ente di previdenza obbligatoria per gli avvocati italiani.                                                                     |
| **Contributo integrativo (CPA)** | 4% applicato in fattura sull'imponibile, addebitato al committente, versato alla Cassa Forense. Spesso indicato come "CPA 4%". |
| **Contributo soggettivo**        | Contributo personale del professionista alla Cassa Forense, **non** in fattura.                                                |

## Anagrafica

| Termine                   | Significato                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Partita IVA**           | Identificativo fiscale, 11 cifre per le persone fisiche italiane. Obbligatoria per emettere fattura.                                       |
| **Codice Fiscale**        | Identificativo personale, 16 caratteri alfanumerici per le persone fisiche.                                                                |
| **Ordine degli Avvocati** | Albo professionale di iscrizione obbligatoria, su base territoriale (es. "Ordine degli Avvocati di Milano").                               |
| **Ragione sociale**       | Denominazione formale dell'attività; per il freelance coincide spesso col nome del titolare. In Pratix: "Ragione sociale / Denominazione". |

## Termini tecnici di prodotto

| Termine                      | Significato                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **RLS** (Row-Level Security) | Meccanismo Postgres/Supabase che limita le righe visibili in base all'utente loggato. Vedi [database](./guides/database.md).   |
| **Edge function**            | Funzione serverless che gira al bordo della rete, usata per logica server-side (es. invio mail).                               |
| **Token semantico**          | Variabile CSS che descrive un ruolo (es. `--background`) e non un colore (es. `#fff`). Vedi [tema](./guides/tema-e-design.md). |
