# Piano stampabile — Evoluzione recupero crediti

- **Prodotto**: Pratix
- **Data**: 2026-05-03
- **Stato**: piano di evoluzione chiuso per avvio implementazione
- **Documento completo**: `docs/plans/evoluzione-recupero-crediti.md`
- **ADR di riferimento**: `docs/decisions/0013-focus-recupero-crediti.md`

## Sintesi

Pratix evolve da gestionale legale generalista per avvocati freelance a SaaS
prevalentemente focalizzato sul recupero crediti.

La **Pratica** resta l'entità centrale. Nel nuovo dominio una pratica nasce
dall'incrocio fra **Committente**, **Cliente** e **Controparte**, contiene
**Attività** fatturabili e alimenta la **Fattura** emessa al committente per un
periodo scelto.

```text
Committente -> Cliente -> Controparte -> Pratica -> Attività -> Fattura
```

Il modulo scadenze viene rimosso dal perimetro evolutivo.

## Decisioni confermate

1. In UI si usa sempre **Pratica**, non "Posizione".
2. In UI si usa sempre **Committente**, non "Mandante".
3. Il committente è il soggetto a cui l'avvocato fattura.
4. Il cliente è il soggetto collegato al portafoglio del committente e alla
   posizione creditoria.
5. Un cliente può essere collegato a più committenti, ma ha un'unica
   anagrafica condivisa.
6. La controparte può essere persona fisica, società o gruppo di soggetti.
7. I soggetti di una controparte composta non hanno ruoli applicativi.
8. La controparte raccoglie nome/cognome oppure ragione sociale, più note.
9. In caso di cessione del credito, la pratica mantiene numero e mostra solo il
   cliente corrente.
10. Il numero pratica è numerico puro e unico per utente.
11. Pratix traccia solo attività fatturabili all'avvocato, non capitale,
    interessi, incassi o residuo del credito.
12. La pratica ha stati propri: aperta, in corso, sospesa, chiusa,
    archiviata.
13. Le attività hanno solo stato **da fatturare** o **fatturata**.
14. Compensi e onorari sono sinonimi.
15. I compensi/onorari sono sempre imponibili.
16. I rimborsi spese sono sempre anticipazioni Art. 15.
17. La label principale per listini/tariffe è **Prezzi**.
18. Per la V1 tutti i committenti usano lo stesso set di prezzi e lo stesso
    template.
19. I prezzi possono cambiare su base annua.
20. La data attività decide quale prezzo applicare.
21. Gli allegati sono consigliati, non obbligatori, sia per compensi sia per
    rimborsi spese.
22. Gli allegati supportano upload, download, anteprima, nome descrittivo,
    note e tipo documento.
23. La fattura viene generata per committente + periodo.
24. Alla fattura si allegano due rendiconti Excel nel formato del committente:
    onorari/compensi e rimborsi spese.
25. Un'attività può essere rinviata al periodo successivo e poi rinviata di
    nuovo.
26. L'import deve essere sia guidato manuale sia da Excel strutturato.
27. Il database attuale contiene solo dati di test e può essere trasformato
    liberamente.

## Entità principali

| Entità              | Ruolo nel prodotto                                                             |
| ------------------- | ------------------------------------------------------------------------------ |
| Committente         | Soggetto fatturato dall'avvocato.                                              |
| Cliente             | Soggetto collegato al portafoglio del committente e alla posizione creditoria. |
| Controparte         | Soggetto o gruppo di soggetti verso cui si svolge il recupero.                 |
| Pratica             | Unità centrale data da committente, cliente e controparte.                     |
| Attività            | Voce fatturabile registrata nella pratica.                                     |
| Compenso / Onorario | Attività a prezzo fisso, sempre imponibile.                                    |
| Rimborso spese      | Anticipazione Art. 15 con importo libero e categoria ammessa dai prezzi.       |
| Prezzi              | Set annuale di voci ammesse per compensi e rimborsi.                           |
| Fattura             | Documento emesso al committente per periodo, con attività incluse.             |
| Rendiconto Excel    | Allegato richiesto dal committente in formato onorari/compensi o rimborsi.     |

## Prezzi estratti dal template onorari

| Voce / fase                                                                          | Prezzo unitario |
| ------------------------------------------------------------------------------------ | --------------: |
| Procedura cartacea                                                                   |         80,00 € |
| Procedura telematica                                                                 |         40,00 € |
| Precetto                                                                             |         25,00 € |
| Pignoramento mobiliare presso terzi, con iscrizione a ruolo                          |         90,00 € |
| Pignoramento mobiliare presso terzi, senza iscrizione a ruolo                        |         60,00 € |
| Pignoramento immobiliare diretto, attività fino all'udienza ex art. 569 c.p.c.       |        150,00 € |
| Pignoramento immobiliare diretto, decorrenza 12 mesi dall'udienza ex art. 569 c.p.c. |        150,00 € |
| Pignoramento immobiliare diretto, distribuzione somme                                |        150,00 € |
| Intervento in procedura esecutiva immobiliare, deposito intervento                   |        100,00 € |
| Intervento in procedura esecutiva immobiliare, decorrenza 12 mesi dal deposito       |        100,00 € |
| Intervento in procedura esecutiva immobiliare, distribuzione somme                   |        100,00 € |
| Accesso in cancelleria o richiesta notificazione non inclusa in altre fasi           |         25,00 € |
| Procedimenti ordinari, mediazione, esecutivi o concorsuali: udienza sostenuta        |         40,00 € |
| Partecipazione vendita senza aggiudicazione                                          |        100,00 € |
| Partecipazione vendita con aggiudicazione e immissione nel possesso                  |        200,00 € |
| Partecipazione a vendite contestuali / incontri per assenso cancellazione ipoteche   |        170,00 € |

## Categorie rimborso estratte dal template spese

| Categoria rimborso                 | Regola importo |
| ---------------------------------- | -------------- |
| Costo notifica                     | Importo libero |
| Costo notifica precetto            | Importo libero |
| Costo pignoramento                 | Importo libero |
| Eventuale importo del conguaglio   | Importo libero |
| Marche da bollo                    | Importo libero |
| Altre spese, ad esempio spedizioni | Importo libero |

## Esempio operativo tipo

| Campo                         | Valore                                                            |
| ----------------------------- | ----------------------------------------------------------------- |
| Numero pratica                | 157                                                               |
| Committente                   | iLaw                                                              |
| Cliente                       | Penelope                                                          |
| Controparte                   | Gruppo 3C Srl                                                     |
| Controparte composta          | No                                                                |
| Cliente precedente / cessione | Vuoto                                                             |
| Stato pratica                 | Aperta                                                            |
| Data apertura                 | 5 aprile 2026                                                     |
| Attività                      | 7 aprile 2026, 1 accesso in cancelleria, fatturato                |
| Rimborso spese                | 25 aprile 2026, costo pignoramento, 35,26 €, allegato se presente |
| Fatturazione                  | Trimestrale                                                       |
| Note particolari              | Vuoto                                                             |

La pratica può restare **aperta** anche se una singola attività è già
**fatturata**. Lo stato della pratica e lo stato dell'attività restano
separati.

## Modello dati target

| Tabella proposta             | Scopo principale                                  |
| ---------------------------- | ------------------------------------------------- |
| `principals`                 | Committenti.                                      |
| `clients`                    | Clienti condivisi.                                |
| `principal_clients`          | Relazione molti-a-molti committenti-clienti.      |
| `counterparties`             | Controparti aggregate.                            |
| `counterparty_subjects`      | Soggetti interni a una controparte composta.      |
| `cases`                      | Pratiche.                                         |
| `case_credit_transfers`      | Storico cessioni cliente X -> cliente Y.          |
| `price_books`                | Prezzi annuali.                                   |
| `price_items`                | Voci di compenso/onorario o rimborso spese.       |
| `case_activities`            | Attività registrate nella pratica.                |
| `activity_attachments`       | Allegati delle attività.                          |
| `billing_runs`               | Estrazioni per committente + periodo.             |
| `billing_run_items`          | Attività incluse, escluse o rinviate.             |
| `billing_exports`            | Rendiconti Excel generati.                        |
| `invoices` / `invoice_lines` | Fatture e righe aggiornate per il nuovo dominio.  |
| `imports` / `import_rows`    | Staging e validazione per import guidato o Excel. |

## Flusso fatturazione

1. L'utente seleziona committente e periodo.
2. Pratix mostra le attività da fatturare nel periodo.
3. L'utente include o rinvia singole attività.
4. Pratix genera la fattura al committente.
5. Pratix genera i rendiconti Excel onorari/compensi e rimborsi spese.
6. Le attività incluse passano a **fatturata**.
7. Le attività rinviate restano **da fatturare** e ricompaiono nel periodo
   successivo.

## Import archivio

L'archivio pregresso è un quaderno cartaceo scritto a mano, quindi il flusso
principale deve essere manuale e guidato.

Il wizard deve permettere di:

1. scegliere o creare il committente;
2. scegliere o creare il cliente;
3. scegliere o creare la controparte;
4. inserire o generare il numero pratica;
5. aggiungere attività storiche;
6. aggiungere rimborsi spese e allegati;
7. rivedere e confermare.

L'import Excel resta previsto con upload, mappatura colonne, validazione,
anteprima, staging e conferma finale.

## Fasi di implementazione

| Fase | Obiettivo                        | Deliverable principali                                                                                                                                                        | Uscita fase                                                                              |
| ---- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0    | Piano e governance               | Piano completo, versione stampabile, ADR 0013, glossario, roadmap, changelog.                                                                                                 | Dominio confermato, nessuna modifica al codice applicativo.                              |
| 1    | Rimozione scadenzario            | Route `/scadenze`, sidebar, dashboard, tab pratica, componenti e tabella `case_deadlines` rimossi o disattivati.                                                              | Nessuna superficie punta allo scadenzario; build e lint passano.                         |
| 2    | Nuovo schema recupero crediti    | Migration Supabase per committenti, clienti, controparti, pratiche, cessioni, prezzi, attività, allegati, fatturazione e import. RLS owner-scoped e tipi Supabase aggiornati. | Schema applicabile da database vuoto, numero pratica unico, RLS completa.                |
| 3    | Anagrafiche                      | UI e server functions per committenti, clienti condivisi, relazione multi-committente, controparti e soggetti composti. Selettori riusabili.                                  | Committente, cliente e controparte sono creabili e riutilizzabili nei flussi successivi. |
| 4    | Prezzi annuali                   | UI Prezzi, voci compensi/onorari, categorie rimborsi Art. 15, duplicazione anno precedente, snapshot prezzo su attività.                                                      | Prezzi 2025 rappresentabili; la data attività seleziona il prezzo corretto.              |
| 5    | Pratiche e attività              | Form pratica, numero manuale/generato, stati pratica, timeline attività, compensi, rimborsi, allegati e gestione cessione credito.                                            | L'esempio pratica 157 è inseribile end-to-end.                                           |
| 6    | Fatturazione committente/periodo | Estrazione attività, inclusione/rinvio, fattura al committente, blocco attività fatturate, rendiconti Excel onorari/compensi e rimborsi.                                      | Fattura e due rendiconti Excel generabili; attività incluse non si duplicano.            |
| 7    | Import archivio                  | Wizard manuale per quaderno cartaceo, creazione inline anagrafiche, attività storiche, import Excel con mapping, staging, validazione, anteprima e conferma.                  | Import manuale completo e import Excel senza scrittura diretta prima della revisione.    |
| 8    | Rifinitura operativa             | Ricerca, filtri, dashboard coerente, export essenziali, test mirati su numerazione, prezzi, rinvii, fatturazione, rendiconti Excel e RLS.                                     | Flussi principali pronti per release e pubblicazione.                                    |

### Dettaglio minimo per implementazione completa

1. La **Fase 1** deve chiudere ogni riferimento operativo allo scadenzario,
   inclusi routing, dashboard, dettaglio pratica, schema e copy.
2. La **Fase 2** deve definire vincoli e policy prima della UI: numero pratica
   numerico unico, stati ammessi, snapshot prezzi e generazione atomica del
   prossimo numero.
3. La **Fase 3** deve produrre selettori riusabili, perché pratica, import e
   fatturazione dipendono tutti da committente, cliente e controparte.
4. La **Fase 4** deve separare compensi fissi e rimborsi Art. 15 a importo
   libero, congelando sempre i dati usati nelle attività.
5. La **Fase 5** deve coprire anche allegati e cessione credito, non solo il
   form base della pratica.
6. La **Fase 6** deve impedire doppie fatturazioni, gestire rinvii e produrre
   entrambi i rendiconti Excel richiesti dal committente.
7. La **Fase 7** deve trattare l'archivio cartaceo come flusso primario, non
   come eccezione.
8. La **Fase 8** chiude usabilità e affidabilità: filtri, ricerca, export,
   test, RLS, documentazione e release.

## Punti rinviati

1. Campi esatti del wizard di import.
2. Validazioni dettagliate degli Excel.
3. Eventuali template vuoti futuri del committente.
4. Regole fiscali di dettaglio su fatture emesse e poi annullate.
5. Priorità definitiva delle singole fasi di sviluppo.
