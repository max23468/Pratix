# Piano — Evoluzione recupero crediti

- **Stato**: piano di prodotto approvato per la fase di progettazione
- **Data**: 2026-05-03
- **Ambito**: evoluzione funzionale di Pratix dopo la migrazione GitHub + Vercel + Supabase
- **Riferimento ADR**: [ADR 0013](../decisions/0013-focus-recupero-crediti.md)

## Obiettivo

Pratix evolve da gestionale legale generalista per avvocati freelance a SaaS
focalizzato prevalentemente su pratiche di recupero crediti.

La **Pratica** resta l'entità centrale del prodotto. Nel nuovo dominio una
pratica rappresenta una posizione di recupero crediti data dall'incrocio tra:

```text
Committente -> Cliente -> Controparte -> Pratica
```

La pratica contiene poi **Attività** fatturabili all'avvocato, distinte in
compensi e rimborsi spese, che confluiscono nelle fatture emesse al
committente per un periodo scelto.

## Decisioni già definite

1. Il termine di prodotto resta **Pratica**, non "Posizione". "Posizione" può
   restare sinonimo descrittivo nei testi lunghi, ma non diventa la label
   principale.
2. Il **Committente** è il soggetto a cui l'avvocato emette fattura.
3. In UI il soggetto fatturato si chiama sempre **Committente**, mai
   "Mandante".
4. Un **Cliente** può appartenere a più committenti.
5. Se lo stesso cliente è collegato a più committenti, l'anagrafica resta unica
   e condivisa.
6. La **Controparte** può essere composta da più soggetti, ciascuno con dati
   propri e selezionabile separatamente.
7. I soggetti di una controparte composta non hanno ruoli applicativi.
8. La controparte raccoglie solo nome/cognome, oppure ragione sociale, più note.
9. In caso di cessione del credito, la pratica mantiene lo stesso numero e
   mostra solo il cliente corrente.
10. Il numero pratica è **numerico puro** e unico per utente.
11. Pratix traccia solo le attività fatturabili all'avvocato, non la contabilità
    del credito sottostante, incassi, capitale, interessi o residuo.
12. La pratica ha stati propri.
13. Lo stato delle attività è volutamente minimo: **da fatturare** o
    **fatturata**.
14. Gli importi dei compensi non sono modificabili sulla singola pratica:
    derivano dai prezzi del committente validi per anno.
15. Per la V1 ogni committente può avere una configurazione autonoma che abilita
    compensi, rimborsi spese o entrambi.
16. Per la V1 ogni committente può personalizzare elenco prezzi e prezzo
    unitario, partendo dal template comune come modello iniziale.
17. I prezzi possono cambiare al massimo su base annua, all'inizio dell'anno.
18. La data che decide quale prezzo applicare è la **data attività**.
19. Il calcolo dei compensi avviene sempre come **quantità attività x prezzo
    unitario**.
20. I rimborsi spese sono sempre anticipazioni Art. 15.
21. I compensi/onorari sono sempre imponibili.
22. Gli allegati sono consigliati, non obbligatori, sia per rimborsi spese sia
    per compensi.
23. Gli allegati devono supportare upload, download, anteprima, nome
    descrittivo, note e tipo documento.
24. La fattura viene generata per **committente + periodo**, non per singolo
    cliente.
25. In fatturazione l'utente può attivare un flag per includere le **spese
    generali**, calcolate come 10% del totale compensi.
26. La cassa forense 4% si applica solo a totale compensi + spese generali, mai
    ai rimborsi spese Art. 15.
27. Alla fattura si allegano rendiconti Excel nel formato fornito dal
    committente: uno per onorari/compensi e uno per rimborsi spese.
28. Le attività possono essere escluse da una fattura e rinviate a un periodo
    successivo senza motivazione obbligatoria.
29. Un'attività rinviata ricompare automaticamente nel periodo successivo e può
    essere rinviata ancora.
30. L'import deve supportare sia Excel strutturato sia inserimento guidato
    voce per voce.
31. Il formato Excel ricevuto dal committente va replicato negli output, anche
    se la UI interna può essere diversa.
32. La label principale per listini/tariffe in UI è **Prezzi**.
33. L'archivio pregresso oggi è un quaderno cartaceo scritto a mano: non è
    disponibile come file e va gestito con inserimento guidato/manuale.
34. Il database attuale contiene solo dati di test: non serve preservare i dati
    esistenti e il modello può essere trasformato liberamente.

## Materiali e stato acquisizione

Materiali ricevuti o ancora utili per dettagliare l'implementazione:

1. Template onorari/compensi condiviso: ricevuto ed estratto da
   `onorari-iv-trim-2025.xlsx`. Da usare solo come riferimento locale e non da
   committare.
2. Esempio anonimizzato di pratica reale con committente, cliente,
   controparte, numero pratica, attività, compensi, spese e fatturazione:
   ricevuto e riportato come caso operativo tipo.
3. Archivio pregresso: non arriverà un file, perché è un quaderno cartaceo
   scritto a mano. Il piano deve quindi prevedere trascrizione guidata.
4. Regole operative di fatturazione ricorrenti già note, se diverse dalla
   regola generale committente + periodo: opzionali se emergono eccezioni.
5. Template rendiconto trimestrale rimborsi: ricevuto ed estratto da
   `spese-iv-trim-2025.xlsx`. Da usare solo come riferimento locale e non da
   committare.
6. Template 2026 ricevuti come riferimento locale non committato:
   `onorari-i-trim-2026.xlsx` e `spese-i-trim-2026.xlsx`. Sono salvati nella
   cartella ignorata `private-templates/pricing-templates/2026/`; i prezzi 2026
   coincidono con quelli 2025 finché non viene deciso diversamente.

## Esempio operativo tipo

Esempio inventato ma credibile, utile per verificare modello dati, UI e
fatturazione:

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
| Fatturazione                  | Trimestrale, con attività includibili o rinviabili nel rendiconto |
| Note particolari              | Vuoto                                                             |

L'esempio conferma una separazione importante: la pratica può restare
**aperta** anche se una singola attività è già **fatturata**. Lo stato della
pratica governa l'avanzamento della posizione; lo stato dell'attività governa
la fatturazione.

## Punti rinviati all'implementazione

Non bloccano il piano, ma vanno definiti mentre si costruiscono le singole
fasi:

1. Campi esatti del wizard di import guidato e ordine definitivo degli step.
2. Validazioni dettagliate per import Excel e rendiconti Excel generati.
3. Template vuoti del committente, se in futuro saranno forniti oltre agli
   esempi già compilati.
4. Regole fiscali di dettaglio sulla gestione di fatture emesse e poi
   annullate, da trattare con conferma esplicita prima di implementare
   cancellazioni distruttive.
5. Priorità operative fra rimozione scadenzario, modello dati, anagrafiche,
   prezzi, pratiche, attività, fatturazione e import.

## Glossario operativo

### Committente

Società o ente per cui l'avvocato lavora contrattualmente e a cui viene emessa
fattura. Ha una propria anagrafica fiscale. Nella V1 ha prezzi annuali propri,
con flag per abilitare compensi, rimborsi spese o entrambi.

### Cliente

Società collegata a uno o più committenti. Nel recupero crediti è solitamente
il soggetto titolare del credito o la società veicolo collegata al portafoglio
del committente.

### Controparte

Soggetto verso cui si svolge l'attività di recupero crediti o assistenza
legale. Può essere persona fisica, società o gruppo di soggetti. Se composta,
ogni soggetto deve poter avere dati propri ed essere selezionato singolarmente,
senza ruoli applicativi. I dati minimi sono nome/cognome oppure ragione sociale,
più note.

### Pratica

Unità centrale di lavoro. Nasce dall'incrocio fra committente, cliente e
controparte. Ha numero numerico puro, unico per utente, inseribile manualmente
o generabile automaticamente.

### Attività

Voce operativa svolta nella pratica e fatturabile all'avvocato. Esempi:
precetto, notifica decreto ingiuntivo, pignoramento, udienza, raccomandata,
deposito, accesso, richiesta documentale.

### Compenso

Sinonimo di **Onorario**. Attività con importo unitario definito dai prezzi del
committente per l'anno di competenza. L'importo unitario non si modifica sulla
singola pratica; il totale è calcolato come quantità per prezzo unitario. I
compensi/onorari sono sempre imponibili.

### Rimborso spese

Attività o voce ammessa dai prezzi del committente con importo liberamente
inseribile dal professionista. I rimborsi spese sono sempre anticipazioni Art. 15. Possono avere allegati di supporto, ma l'allegato non blocca la
fatturazione.

### Prezzi

Insieme annuale delle voci ammesse per le pratiche, configurato per singolo
committente. Ogni committente può abilitare compensi, rimborsi spese o entrambi
e può personalizzare elenco voci e prezzo unitario. Il template comune estratto
dagli Excel resta il modello iniziale da clonare, non un vincolo uguale per
tutti. In UI e documenti di prodotto si usa **Prezzi** come label principale.

## Esempi Excel ricevuti

I file Excel ricevuti sono esempi locali per capire la struttura operativa.
Non vanno copiati nel repository perché possono contenere dati personali o
dati di pratica.

### `onorari-iv-trim-2025.xlsx`

- Periodo: quarto trimestre 2025.
- Foglio rilevato: `Compensi`.
- Struttura: matrice larga con prime colonne anagrafiche/identificative e molte
  colonne dedicate alle singole voci di onorario/compenso.
- Evidenza di dominio: **onorari** e **compensi** sono sinonimi.
- Impatto sul prodotto: il file è soprattutto un **output richiesto dal
  committente** insieme alla fattura. Pratix deve poterlo compilare replicando
  il formato ricevuto. Lo stesso formato può anche guidare import o
  normalizzazione, ma non è solo un input.

Voci prezzo estratte dal template:

| Voce / fase                                                                          | Prezzo unitario |
| ------------------------------------------------------------------------------------ | --------------: |
| Procedura cartacea / Decreto ingiuntivo                                              |         80,00 € |
| Procedura telematica / Decreto ingiuntivo                                            |         40,00 € |
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
| Procedimenti ordinari, mediazione, esecutivi, concorsuali: udienza sostenuta         |         40,00 € |
| Partecipazione vendita senza aggiudicazione                                          |        100,00 € |
| Partecipazione vendita con aggiudicazione e immissione nel possesso                  |        200,00 € |
| Partecipazione a vendite contestuali / incontri per assenso cancellazione ipoteche   |        170,00 € |

### `spese-iv-trim-2025.xlsx`

- Periodo: quarto trimestre 2025.
- Foglio rilevato: `Spese`.
- Struttura: rendiconto trimestrale con data, cliente/posizione e colonne per
  categorie di rimborso.
- Categorie osservate a livello strutturale: notifiche, notifiche precetto,
  pignoramento, conguagli, marche da bollo, altre spese.
- Impatto sul prodotto: il file è soprattutto un **output richiesto dal
  committente** insieme alla fattura. Pratix deve poterlo compilare replicando
  il formato ricevuto. I rimborsi vanno gestiti come anticipazioni Art. 15.

Categorie rimborsi estratte dal template:

| Categoria rimborso                 | Note operative |
| ---------------------------------- | -------------- |
| Costo notifica                     | Importo libero |
| Costo notifica precetto            | Importo libero |
| Costo pignoramento                 | Importo libero |
| Eventuale importo del conguaglio   | Importo libero |
| Marche da bollo                    | Importo libero |
| Altre spese, ad esempio spedizioni | Importo libero |

Campi di contesto del rendiconto: data spesa, cliente, NDG/denominazione e
numero tentativo notifica.

## Modello dati target

Il modello attuale (`clients`, `cases`, `expenses`, `invoices`) è da
considerare trasformabile. Non serve una migrazione conservativa dei dati di
test.

### Tabelle principali

| Tabella proposta             | Scopo                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `principals`                 | Committenti. Dati fiscali, contatti, note, impostazioni di fatturazione e abilitazioni economiche.        |
| `clients`                    | Clienti collegabili a più committenti. L'attuale tabella va reinterpretata o ricreata.                    |
| `principal_clients`          | Relazione molti-a-molti tra committenti e clienti.                                                        |
| `counterparties`             | Anagrafica controparte aggregata con ragione sociale oppure soggetti collegati.                           |
| `counterparty_subjects`      | Soggetti individuali dentro una controparte composta, senza ruoli.                                        |
| `cases`                      | Pratiche: numero, committente, cliente corrente, controparte, stato, note.                                |
| `case_credit_transfers`      | Storico cessioni/passaggi credito cliente X -> cliente Y, mantenendo la stessa pratica.                   |
| `price_books`                | Prezzi per committente e anno, clonabili dal template comune.                                             |
| `price_items`                | Voci di prezzo personalizzabili: compensi/onorari a importo unitario o rimborsi Art. 15 a importo libero. |
| `case_activities`            | Attività della pratica, con snapshot della voce prezzo e stato da fatturare/fatturata.                    |
| `case_activity_hearings`     | Date udienza collegate alle attività che richiedono conteggio udienze sostenute.                          |
| `activity_attachments`       | Metadati degli allegati caricati su Supabase Storage per compensi o rimborsi.                             |
| `billing_runs`               | Selezione di attività per committente + periodo prima della generazione fattura.                          |
| `billing_run_items`          | Attività incluse, escluse o rinviate nella singola estrazione.                                            |
| `billing_exports`            | Rendiconti Excel compilati nel formato del committente e allegati alla fattura.                           |
| `invoices` / `invoice_lines` | Fatture e righe, aggiornate per fatturare al committente e congelare le attività selezionate.             |
| `imports` / `import_rows`    | Import guidati da Excel o inserimento manuale, con staging e validazione prima della conferma.            |

### Relazioni principali

```text
Committente -> Prezzi annuali del committente -> (N) Voci di prezzo
Committente (N) <-> (N) Cliente
Cliente (N) <-> (N) Controparte
Committente + Cliente + Controparte -> Pratica
Pratica (1) -> (N) Attività -> (0..N) Allegati
Committente + Periodo -> Estrazione fatturazione -> Fattura + Rendiconti Excel
```

## Regole di numerazione pratica

1. Il numero pratica è un intero positivo.
2. Il vincolo di unicità resta per utente: non possono esistere due pratiche
   con lo stesso numero.
3. L'utente può inserire manualmente un numero esistente nel proprio archivio
   cartaceo.
4. La generazione automatica propone il primo numero maggiore del massimo già
   presente: `max(numero_pratica) + 1`.
5. La generazione deve essere atomica lato database o server function, così due
   creazioni contemporanee non generano lo stesso numero.
6. La UI deve mostrare subito conflitti di numero e suggerire il prossimo numero
   disponibile.

## Stati pratica

La pratica deve avere stati propri, separati dallo stato delle attività. Per la
prima implementazione si mantengono stati semplici:

- aperta;
- in corso;
- sospesa;
- chiusa;
- archiviata.

Lo stato della pratica serve per organizzare e filtrare il lavoro. Non decide
da solo se un'attività sia fatturabile: quello resta governato dallo stato della
singola attività.

## Cessione del credito

In caso di cessione del credito o passaggio della posizione da cliente X a
cliente Y:

- il numero pratica resta invariato;
- la pratica mostra solo il cliente corrente;
- le attività, anche se create prima della cessione, vengono lette e fatturate
  con il cliente corrente;
- lo storico della cessione può essere conservato come informazione tecnica o
  nota interna, ma non deve complicare la UI ordinaria.

## Prezzi per committente e anno

I prezzi sono specifici per committente e per anno. La data che decide quale
prezzo applicare è la data attività.

Ogni committente deve avere una configurazione economica minima:

- compensi abilitati: sì/no;
- rimborsi spese abilitati: sì/no;
- prezzo annuale attivo;
- voci compenso abilitate e importo unitario;
- categorie rimborso abilitate.

Il template comune 2025 serve come seed iniziale. In creazione committente
Pratix può proporre la copia del template comune, ma l'utente deve poter
disattivare intere sezioni, rimuovere voci non applicabili e modificare i prezzi
unitari del committente.

### Compensi

- Hanno importo definito.
- L'importo viene proposto e poi congelato nell'attività.
- Non sono modificabili manualmente sulla singola pratica.
- Sono sempre imponibili.
- Il totale riga è sempre `quantità x prezzo unitario`.
- Per cambiare importi o voci si crea o aggiorna il prezzario annuale del
  committente.

### Rimborsi spese

- I prezzi definiscono quali voci sono ammesse.
- L'importo è inserito manualmente dall'avvocato.
- Sono sempre anticipazioni Art. 15.
- Gli allegati sono consigliati ma non bloccanti.
- Possono essere disattivati per committente quando il committente non rimborsa
  spese.

### Snapshot

Quando una voce prezzo viene usata in una pratica, `case_activities` deve
salvare almeno:

- nome voce;
- tipo voce (`fee` o `expense_reimbursement`);
- anno prezzi;
- committente e prezzo annuale di origine;
- quantità, prezzo unitario e totale, se compenso;
- importo, se rimborso spese;
- riferimento alla voce prezzo originale.

Questo evita che una modifica futura dei prezzi alteri attività già
registrate o fatturate.

## Attività della pratica

Ogni attività appartiene a una pratica e deriva da una voce prezzo del
committente della pratica.

Campi funzionali minimi:

- data attività;
- pratica;
- voce prezzo;
- tipo: compenso o rimborso spese;
- descrizione visibile in fattura;
- quantità;
- prezzo unitario;
- importo totale calcolato;
- stato: `to_invoice` o `invoiced`;
- fattura collegata quando fatturata;
- note interne;
- allegati facoltativi.

Per i compensi il totale non è inserito liberamente: è calcolato come quantità
dell'attività per prezzo unitario. Per i rimborsi spese resta libero l'importo
anticipato.

La voce **Procedimenti ordinari, mediazione, esecutivi, concorsuali** richiede
un comportamento specifico: l'utente deve poter indicare il numero di udienze
sostenute e la data di ciascuna udienza. Il numero di udienze alimenta la
quantità della riga compenso; le date restano consultabili nel dettaglio
attività e disponibili per rendiconto.

Un'attività rinviata in fatturazione resta `to_invoice`, ricompare
automaticamente nel periodo successivo e può essere rinviata di nuovo.

Lo stato `invoiced` deve essere impostato solo quando l'attività entra in una
fattura salvata/emessa. Se una fattura viene eliminata o riportata a bozza, va
definita una regola esplicita per sbloccare o mantenere bloccate le attività.
Per la prima implementazione si propone:

- fattura in bozza: attività riservate ma modificabili dalla bozza;
- fattura emessa: attività bloccate;
- eliminazione bozza: attività tornano da fatturare;
- eliminazione fattura emessa: richiede conferma forte e riporta le attività da
  fatturare solo se non esistono vincoli fiscali da rispettare.

## Fatturazione

Il modulo fatturazione deve lavorare per committente + periodo.

Flusso desiderato:

1. L'utente apre una nuova estrazione.
2. Seleziona committente e periodo.
3. Pratix mostra tutte le attività da fatturare nel periodo, raggruppate per
   cliente, controparte e pratica.
4. L'utente può includere o rinviare singole attività.
5. L'utente può attivare l'inclusione delle spese generali.
6. Pratix genera una fattura al committente con righe coerenti e importi
   congelati.
7. Pratix calcola, se attivate, le spese generali come 10% del totale compensi.
8. Pratix calcola la cassa forense 4% solo su totale compensi + spese generali.
9. Pratix genera e collega i due rendiconti Excel richiesti dal committente:
   onorari/compensi e rimborsi spese.
10. Le attività incluse passano a `invoiced`.

La fattura deve poter mostrare nelle righe o nel dettaglio:

- numero pratica;
- cliente;
- controparte;
- descrizione attività;
- data o periodo attività;
- quantità, prezzo unitario e importo totale per i compensi;
- importo rimborso per le anticipazioni Art. 15.

Regole fiscali minime:

- i compensi sono imponibili;
- i rimborsi spese sono anticipazioni Art. 15 e non entrano nella base di calcolo
  della cassa forense;
- le spese generali sono opzionali in fatturazione e, se incluse, valgono il 10%
  del totale compensi;
- la cassa forense 4% si applica al totale compensi più spese generali;
- il calcolo deve congelare in fattura flag, aliquote, imponibili e totali usati.

I rendiconti Excel allegati alla fattura devono replicare il formato fornito
dal committente. La UI interna può essere diversa, ma l'output deve rispettare
il tracciato richiesto.

## Allegati

Gli allegati sono facoltativi ma supportati sia per compensi sia per rimborsi.

Regole:

- usare il bucket privato `pratix-documents`;
- non salvare dati personali nel nome file generato dall'app;
- salvare metadati applicativi in tabella, non affidarsi solo allo Storage;
- collegare l'allegato all'attività, non solo alla pratica generica;
- permettere più allegati per attività.
- supportare upload, download, anteprima, nome descrittivo, note e tipo
  documento.

Percorso Storage proposto:

```text
<user_id>/activities/<activity_id>/<file>
```

Se si mantiene la tassonomia attuale, aggiungere `activities` a
`src/lib/storage-paths.ts` e aggiornare la migration Storage per eventuali MIME
type mancanti.

## Import archivio pregresso

L'import deve avere due modalità equivalenti:

1. **Guidato manuale**: inserimento passo per passo di committente, cliente,
   controparte, pratica e attività.
2. **Excel strutturato**: caricamento file, mappatura colonne, validazione,
   anteprima, conferma.

### Import guidato manuale

Flusso consigliato:

1. Scegli o crea committente.
2. Scegli o crea cliente.
3. Scegli o crea controparte e soggetti collegati.
4. Inserisci o genera numero pratica.
5. Aggiungi attività storiche da fatturare o già fatturate, se serve.
6. Rivedi riepilogo e conferma.

### Import Excel

Flusso consigliato:

1. Upload file.
2. Lettura intestazioni.
3. Mappatura colonne verso campi Pratix.
4. Validazione righe: duplicati, numeri pratica, committente mancante, cliente
   non collegato, controparte incompleta, voce prezzo non riconosciuta.
5. Anteprima errori e avvisi.
6. Import in staging.
7. Conferma finale e scrittura nelle tabelle operative.

Il sistema non deve scrivere direttamente dati importati nelle tabelle
operative senza una fase di revisione.

Il flusso guidato manuale e il flusso di creazione pratica completa possono
condividere gli stessi step. La scelta fra "Nuova pratica guidata" e "Import
archivio" è di navigazione, non di modello dati.

## Rimozione scadenzario

Il modulo scadenze non serve più nel perimetro scelto.

Da rimuovere in una fase dedicata:

- route `/scadenze`;
- voce sidebar "Scadenze";
- componente `DeadlineDialog`;
- tab "Scadenze" nel dettaglio pratica;
- card dashboard "Scadenze";
- tabella `case_deadlines` e relative policy/foreign key;
- riferimenti in documentazione, roadmap, meta tag e copy pubblico.

Attenzione: resta legittima la parola "scadenza" per concetti fiscali o di
pagamento, ad esempio "scadenza pagamento" della fattura.

## Fasi di implementazione

Ogni fase deve chiudersi con verifiche proporzionate e documentazione
allineata. Le fasi sono pensate per essere implementabili una alla volta, senza
lasciare il prodotto in uno stato ambiguo.

### Fase 0 — Piano e governance

**Obiettivo**: fissare il dominio prima del codice.

Attività:

1. Salvare questo piano nel repo.
2. Aggiungere ADR 0013.
3. Aggiornare glossario, roadmap e changelog.
4. Allineare le regole agenti: "attività" torna termine centrale; "studio" non
   è più vietata in assoluto, pur restando fuori dal posizionamento primario.

Uscita fase:

- piano completo disponibile;
- ADR accettato;
- roadmap e changelog allineati;
- nessuna modifica al codice applicativo.

### Fase 1 — Reset dominio e rimozione scadenzario

**Obiettivo**: togliere dal prodotto il modulo non più coerente con il nuovo
perimetro.

Attività:

1. Rimuovere route `/scadenze` e collegamenti di navigazione.
2. Rimuovere voce sidebar, card dashboard e tab scadenze nel dettaglio pratica.
3. Rimuovere o adattare componenti dedicati allo scadenzario.
4. Rimuovere server functions, query, tipi UI e helper collegati a
   `case_deadlines`.
5. Creare migration per rimuovere `case_deadlines` e riferimenti collegati, se
   non più usati.
6. Aggiornare `docs/data-model.md`, glossario e copy pubblico/autenticato che
   descrive ancora Pratix come prodotto basato sulle scadenze.
7. Verificare dashboard, elenco pratiche e dettaglio pratica dopo la rimozione.

Uscita fase:

- nessuna pagina o navigazione punta allo scadenzario;
- build e lint passano;
- schema e documentazione non presentano più `case_deadlines` come modulo
  attivo.

### Fase 2 — Nuovo schema recupero crediti

**Obiettivo**: creare la base dati del nuovo dominio.

**Stato**: completata su migration
`20260503202905_phase_2_debt_collection_schema.sql`, applicata al progetto
Supabase collegato e con tipi TypeScript rigenerati. La migration è compatibile
con la UI attuale: aggiunge il nuovo dominio senza rimuovere le colonne legacy
ancora usate dalle schermate esistenti.

Attività:

1. Disegnare migration Supabase per:
   `principals`, `clients`, `principal_clients`, `counterparties`,
   `counterparty_subjects`, `cases`, `case_credit_transfers`, `price_books`,
   `price_items`, `case_activities`, `case_activity_hearings`,
   `activity_attachments`, `billing_runs`, `billing_run_items`,
   `billing_exports`, `imports`, `import_rows`.
2. Reinterpretare o ricreare le tabelle esistenti senza preservare dati di
   test.
3. Applicare `user_id` e RLS owner-scoped a ogni tabella user-owned.
4. Definire vincoli chiave:
   - numero pratica numerico positivo e unico per utente;
   - relazione pratica -> committente, cliente corrente, controparte;
   - stato pratica ammesso;
   - stato attività ammesso;
   - tipo voce prezzo ammesso;
   - snapshot prezzo su attività;
   - prezzo annuale associato al committente;
   - quantità, prezzo unitario e totale sulle attività di compenso;
   - flag compensi/rimborsi sul committente;
   - flag spese generali e basi di calcolo in fatturazione.
5. Definire funzioni o trigger per generazione atomica del numero pratica.
6. Aggiornare `docs/data-model.md` e `supabase/schema.sql`.
7. Rigenerare `src/integrations/supabase/types.ts` solo con `npm run db:types`.

Uscita fase:

- migration applicabile da database vuoto;
- RLS completa;
- tipi Supabase aggiornati;
- modello dati documentato;
- test o query manuali confermano unicità numero pratica e policy owner-scoped.

### Fase 3 — Anagrafiche

**Stato**: implementata nella UI operativa.

**Obiettivo**: permettere all'utente di creare e mantenere le entità base.

Attività:

1. Aggiungere sezione **Committenti** con elenco, dettaglio, creazione,
   modifica e archiviazione se utile.
2. Evolvere **Clienti** per supportare relazione molti-a-molti con
   committenti.
3. Aggiungere **Controparti** con supporto persona fisica, società e
   controparte composta.
4. Gestire soggetti interni alla controparte senza ruoli applicativi.
5. Creare selettori riusabili per committente, cliente e controparte.
6. Definire empty state e microcopy coerenti col nuovo dominio.
7. Aggiornare navigazione e ricerca locale dove serve.

Uscita fase:

- l'utente può creare committente, cliente condiviso e controparte;
- un cliente può essere collegato a più committenti;
- una controparte composta può contenere più soggetti selezionabili;
- i selettori sono pronti per pratica, import e fatturazione.

### Fase 4 — Prezzi per committente e anno

**Stato**: implementata nella UI operativa. Il template comune 2025 è disponibile anche per il 2026, perché i prezzi 2026 coincidono con quelli 2025 nella configurazione iniziale.

**Obiettivo**: rendere configurabili le voci economiche usate dalle attività.

Attività:

1. Creare UI **Prezzi** con committente, anno, stato e voci.
2. Aggiungere per ogni committente i flag: compensi abilitati e rimborsi spese
   abilitati.
3. Inserire il template comune 2025 come modello iniziale clonabile.
4. Consentire personalizzazione per committente di elenco voci e prezzo unitario.
5. Inserire le voci compensi/onorari estratte dal template 2025 con i nomi
   aggiornati.
6. Inserire categorie rimborsi spese estratte dal template spese.
7. Distinguere compensi a importo unitario e rimborsi Art. 15 a importo libero.
8. Consentire duplicazione dei prezzi da anno precedente per lo stesso
   committente.
9. Bloccare o avvisare sulle modifiche a voci già usate in attività.
10. Preparare import Excel delle voci prezzo, anche se la V1 può partire con
    inserimento manuale/seed controllato.
11. Gestire la voce "Procedimenti ordinari, mediazione, esecutivi, concorsuali"
    come voce con quantità derivata dal numero di udienze.

Uscita fase:

- i prezzi 2025 sono rappresentabili nel database per singolo committente;
- un committente può usare solo compensi, solo rimborsi o entrambi;
- la data attività seleziona il prezzo dell'anno corretto;
- una voce prezzo usata produce snapshot nell'attività;
- le modifiche future non alterano attività già create.

### Fase 5 — Pratiche e attività

**Obiettivo**: costruire il cuore operativo del recupero crediti.

Attività:

1. Ricostruire form pratica con committente, cliente, controparte, numero,
   stato, data apertura e note.
2. Implementare inserimento manuale e generazione automatica del numero
   pratica.
3. Validare conflitti numero pratica in tempo utile e suggerire il prossimo
   disponibile.
4. Implementare dettaglio pratica con dati principali, stato e timeline/elenco
   attività.
5. Aggiungere attività da voce prezzo, distinguendo compenso e rimborso spese.
6. Gestire sempre quantità, prezzo unitario e totale per i compensi.
7. Gestire allegati facoltativi per attività con upload, download, anteprima,
   nome descrittivo, note e tipo documento.
8. Gestire udienze sostenute per "Procedimenti ordinari, mediazione, esecutivi,
   concorsuali", con numero udienze e data di ciascuna.
9. Rispettare i flag del committente: se compensi o rimborsi non sono abilitati,
   la UI non deve proporre voci non applicabili.
10. Gestire cessione credito cambiando il cliente corrente e mantenendo lo
    storico tecnico.

Uscita fase:

- l'esempio pratica 157 è inseribile end-to-end;
- numero pratica unico, manuale o generato;
- attività e rimborsi sono registrabili;
- i compensi calcolano il totale come quantità x prezzo unitario;
- le udienze sono tracciabili con date;
- allegati collegati all'attività funzionano sul bucket privato;
- pratica e attività mantengono stati separati.

### Fase 6 — Fatturazione per committente e periodo

**Obiettivo**: trasformare attività da fatturare in fattura e rendiconti.

Attività:

1. Creare flusso estrazione per committente + periodo.
2. Mostrare attività da fatturare raggruppate per cliente, controparte e
   pratica.
3. Consentire inclusione o rinvio della singola attività.
4. Salvare `billing_run` e `billing_run_items` con stato incluso/rinviato.
5. Aggiungere flag di fatturazione per includere o escludere spese generali.
6. Calcolare spese generali al 10% del totale compensi quando il flag è attivo.
7. Calcolare cassa forense 4% solo su totale compensi + spese generali.
8. Escludere sempre i rimborsi spese Art. 15 dalla base cassa forense.
9. Generare fattura al committente con righe coerenti.
10. Collegare attività incluse alla fattura e impostarle come fatturate.
11. Mantenere attività rinviate da fatturare e farle ricomparire nel periodo
    successivo.
12. Generare rendiconto Excel onorari/compensi nel formato del template,
    includendo quantità e prezzo unitario coerenti con il file.
13. Generare rendiconto Excel rimborsi spese nel formato del template.
14. Salvare i rendiconti come export collegati alla fattura.
15. Definire comportamento bozza/emessa/eliminata secondo le regole del piano.

Uscita fase:

- una fattura per committente + periodo è generabile;
- attività incluse non vengono duplicate in fatture successive;
- attività rinviate riappaiono nel periodo dopo;
- i due file Excel richiesti dal committente vengono generati e collegati;
- compensi, spese generali, cassa forense e rimborsi restano fiscalmente
  distinti;
- i rimborsi non entrano mai nella base di calcolo della cassa forense.

### Fase 7 — Import archivio

**Obiettivo**: permettere la trascrizione dell'archivio cartaceo e l'import da
file strutturati.

Attività:

1. Costruire wizard manuale per creare pratica completa passo per passo.
2. Consentire creazione inline di committente, cliente e controparte.
3. Consentire inserimento di attività storiche già fatturate o da fatturare.
4. Consentire inserimento rimborsi spese e allegati durante il flusso.
5. Aggiungere riepilogo finale prima della conferma.
6. Costruire import Excel con upload, lettura intestazioni, mappatura colonne,
   validazione, staging, anteprima e conferma.
7. Gestire errori su duplicati numero pratica, committente mancante, cliente non
   collegato, controparte incompleta e voce prezzo non riconosciuta.
8. Evitare scrittura diretta nelle tabelle operative prima della conferma.

Uscita fase:

- l'utente può trascrivere una pratica da quaderno cartaceo senza usare Excel;
- l'import Excel non scrive dati operativi senza revisione;
- errori e avvisi sono comprensibili e correggibili;
- il flusso riusa selettori e validazioni già usati da pratica e anagrafiche.

### Fase 8 — Rifinitura operativa

**Obiettivo**: rendere il nuovo dominio usabile come SaaS quotidiano.

Attività:

1. Uniformare empty state, filtri e ricerca su committente, cliente,
   controparte e pratica.
2. Aggiungere viste e ordinamenti utili: pratiche aperte, da fatturare,
   fatturate, sospese, archiviate.
3. Rifinire dashboard sul nuovo dominio, senza scadenzario.
4. Aggiungere export dati essenziali se utile per controllo e backup.
5. Scrivere test mirati su:
   - generazione numero pratica;
   - snapshot prezzi;
   - attività rinviate;
   - blocco attività fatturate;
   - rendiconti Excel;
   - RLS.
6. Verificare UI desktop/mobile e chiaro/scuro nelle superfici principali.
7. Aggiornare onboarding, documentazione, roadmap e changelog in vista del
   rilascio.

Uscita fase:

- flussi principali usabili senza dati di test;
- verifiche tecniche passate;
- documentazione allineata;
- pronto per release e pubblicazione.

## Criteri di completamento

La prima evoluzione è completa quando:

- il modulo scadenze è rimosso;
- si possono creare committenti, clienti, controparti e pratiche;
- una pratica ha numero numerico unico, manuale o generato;
- i prezzi annuali del committente guidano compensi e rimborsi;
- un committente può avere compensi, rimborsi spese o entrambi;
- i compensi sono calcolati come quantità x prezzo unitario;
- la fatturazione gestisce spese generali opzionali e cassa forense sulla base
  corretta;
- le attività possono essere registrate e allegate;
- una fattura per committente + periodo può includere o rinviare attività;
- la fattura può avere allegati Excel compilati nel formato del committente;
- le attività fatturate risultano bloccate o comunque non duplicabili;
- l'import guidato manuale è disponibile;
- l'import Excel ha almeno staging, validazione e anteprima;
- RLS, build e lint sono verificati sulle aree toccate.

## Rischi e attenzioni

- Il termine **Cliente** cambia significato operativo rispetto al Pratix
  attuale: la fattura non va più necessariamente al cliente, ma al committente.
- La relazione molti-a-molti fra committenti e clienti deve essere chiara in UI
  per evitare pratiche collegate al committente sbagliato.
- I prezzi annuali vanno congelati nelle attività per non alterare storico e
  fatture.
- La generazione numero pratica deve essere atomica.
- L'import Excel deve proteggere da duplicati e dati personali nei log.
- La rimozione dello scadenzario tocca routing, dashboard, schema e copy: va
  fatta in una fase isolata.
