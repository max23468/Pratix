# Piano controllo duplicati

Stato: piano funzionale approvato, implementazione da avviare.

Data: 2026-05-16

## Obiettivo

Pratix deve prevenire e gestire potenziali duplicati nelle superfici operative
centrali del recupero crediti:

- Committenti;
- Clienti;
- Controparti;
- Pratiche.

La funzionalità ha due parti complementari:

1. una nuova area operativa per controllare, confrontare e risolvere duplicati
   già presenti;
2. un avviso preventivo nei form, prima di creare un nuovo record che somiglia a
   qualcosa già presente.

Il sistema deve aiutare l'avvocato a mantenere l'archivio ordinato senza
automatismi pericolosi: Pratix segnala, spiega e propone azioni, ma l'utente
decide.

## Nome e posizione nella UI

Nome UI approvato: **Controllo duplicati**.

Posizione:

- voce autonoma nella sidebar autenticata;
- route prevista: `/controllo-duplicati`;
- eventuale richiamo in dashboard solo quando ci sono sospetti aperti, ad
  esempio `4 potenziali duplicati da verificare`.

La funzionalità non va in Account o Impostazioni, perché non è configurazione:
è lavoro operativo sui dati. Non va nemmeno nascosta dentro Clienti,
Committenti o Controparti, perché controlla più entità insieme.

## Scope iniziale

La prima versione copre subito:

- Committenti;
- Clienti;
- Controparti;
- Pratiche.

Fuori scope dalla prima versione:

- Attività duplicate;
- Fatture duplicate;
- controlli schedulati in background o cron;
- deduplica massiva completamente automatica;
- merge silenziosi senza conferma;
- sistemi esterni o nuove dipendenze pesanti non motivate.

## Pagina Controllo duplicati

All'apertura della pagina Pratix calcola i potenziali duplicati. La pagina deve
avere anche un pulsante:

- `Ricontrolla`.

Il ricalcolo avviene quindi:

- quando si apre la pagina;
- quando l'utente preme `Ricontrolla`.

La prima versione non prevede un processo automatico ricorrente in background.

### Filtri e viste

La pagina deve permettere di filtrare i sospetti per:

- `Tutti`;
- `Committenti`;
- `Clienti`;
- `Controparti`;
- `Pratiche`;
- `Risolti`.

Ogni sospetto deve mostrare:

- tipo di record;
- i due record confrontati;
- probabilità o gravità: alta, media, bassa;
- motivo del sospetto;
- data dell'ultimo controllo;
- stato: aperto, rimandato, non duplicato, unito o risolto.

### Motivo del sospetto

Ogni potenziale duplicato deve spiegare perché è emerso. Esempi:

- `Ragione sociale quasi identica`;
- `Nome e cognome molto simili`;
- `Nome e cognome invertiti`;
- `Stessa combinazione committente, cliente e controparte`;
- `Numero pratica uguale`;
- `RG uguale o molto simile`.

Questa spiegazione è parte essenziale della feature: l'utente deve capire il
perché prima di decidere.

## Regole di matching

Il matching deve essere **name-first** e **context-aware**.

I campi come codice fiscale, partita IVA, PEC ed email non sono il motore
principale, perché spesso non vengono compilati dagli utenti. Se presenti e
coincidenti, alzano la probabilità del sospetto; se assenti, il controllo deve
continuare a funzionare.

### Normalizzazione testuale comune

La normalizzazione deve:

- ignorare maiuscole e minuscole;
- rimuovere spazi doppi;
- ridurre punteggiatura e separatori non informativi;
- gestire accenti e apostrofi in modo stabile;
- pesare meno parole comuni o forme giuridiche poco informative;
- non cancellare informazioni utili che distinguono davvero due soggetti.

Per le ragioni sociali, normalizzare anche forme societarie come:

- `srl`, `s.r.l.`;
- `spa`, `s.p.a.`;
- `società`;
- forme equivalenti frequenti nel dominio italiano.

Esempio: `ACME S.R.L.` e `Acme srl` devono risultare molto vicine.

### Committenti

Il match principale usa la ragione sociale normalizzata.

Segnali secondari, se presenti:

- codice fiscale;
- partita IVA;
- PEC;
- email.

Questi segnali confermano o alzano la probabilità, ma non sono obbligatori per
generare un sospetto.

### Clienti

Il match principale usa:

- nome + cognome normalizzati;
- cognome + nome invertiti;
- ragione sociale, quando il Cliente è una società.

Iniziali, abbreviazioni o differenze leggere possono generare sospetti a
probabilità media o bassa, non blocchi forti.

### Controparti

Per Controparti persona:

- nome + cognome normalizzati;
- nome e cognome invertiti.

Per Controparti società o gruppo:

- ragione sociale o nome del gruppo normalizzati.

Per gruppi, i soggetti interni sono segnali aggiuntivi da mostrare nel
confronto, non criteri automatici bloccanti.

### Pratiche

Le Pratiche richiedono più prudenza: il titolo da solo non basta.

Segnali principali:

- numero pratica uguale;
- stesso committente + stesso cliente + controparte simile;
- stesso committente + cliente simile + controparte simile;
- RG e autorità uguali o molto simili.

Segnali secondari:

- titolo pratica simile;
- date operative vicine;
- stesso contesto committente/cliente/controparte.

Il titolo simile può supportare un sospetto, ma non deve essere l'unico criterio
per proporre un merge.

### Soglie

Le soglie devono essere diverse tra pagina e form:

- nella pagina `Controllo duplicati` si possono mostrare anche sospetti medi e
  bassi;
- nei form si mostrano solo sospetti alta o media probabilità, per evitare
  avvisi fastidiosi.

## Azioni di risoluzione

Ogni sospetto deve permettere:

- `Apri confronto`;
- `Segna come non duplicato`;
- `Unisci`;
- `Rimanda`.

### Apri confronto

Mostra i due record affiancati.

Il confronto deve evidenziare:

- campi uguali;
- campi simili;
- campi diversi;
- campi compilati solo in uno dei due record;
- collegamenti principali.

Collegamenti da mostrare quando pertinenti:

- Pratiche;
- Attività;
- allegati;
- Fatture;
- Clienti collegati;
- Committenti collegati;
- Controparti;
- storico stati;
- cessioni credito.

### Segna come non duplicato

Salva la decisione dell'utente. La stessa coppia non deve essere riproposta nei
controlli futuri, salvo cambiamenti rilevanti ai record che rendano nuova la
valutazione.

Questa decisione va persistita, perché senza memoria delle decisioni il tool
diventerebbe fastidioso.

### Rimanda

Lascia il sospetto aperto senza prendere una decisione definitiva.

Serve per casi in cui l'utente vuole rivedere più avanti o completare prima i
dati.

### Unisci

L'utente sceglie quale record mantenere. Pratix mostra sempre cosa verrà
spostato o aggiornato prima della conferma.

Niente merge silenziosi. Ogni unione deve essere confermata esplicitamente.

## Regola sul record perdente

L'unione deve essere prudente.

Il record perdente:

- viene eliminato solo se è una scheda quasi vuota appena creata e senza storico
  rilevante;
- viene mantenuto come assorbito, archiviato o comunque tracciato quando ha
  storico, collegamenti o dati importanti.

La scelta tecnica esatta dipenderà dal modello dati disponibile per ogni entità:
alcune tabelle hanno già un concetto di archiviazione, altre potrebbero
richiedere una tabella di decisioni o un tracciamento separato.

## Merge per entità

### Committenti

Il merge deve poter spostare:

- Clienti collegati;
- Pratiche;
- listini/prezzi compatibili;
- Fatture collegate;
- sessioni di fatturazione collegate.

Conflitti da gestire con cautela:

- listini per lo stesso anno;
- impostazioni economiche diverse;
- dati fiscali o di contatto compilati in entrambi i record.

I campi del record mantenuto non devono essere sovrascritti automaticamente se
già compilati. I dati utili del record assorbito vanno proposti nel confronto o
conservati in nota/tracciamento quando serve.

### Clienti

Il merge deve poter spostare:

- collegamenti `principal_clients`;
- Pratiche;
- eventuali Fatture legacy collegate;
- dati anagrafici utili.

Anche qui il record mantenuto non deve perdere dati compilati. In caso di
conflitto, l'utente deve vedere le differenze e scegliere o conservare il dato
come nota.

### Controparti

Il merge deve poter spostare:

- Pratiche;
- eventuali soggetti interni, per le Controparti di tipo gruppo;
- note o dettagli non strutturati.

Le composizioni dei gruppi non vanno perse. Se entrambe le Controparti hanno
soggetti interni, il confronto deve mostrarli prima dell'unione.

### Pratiche

Il merge delle Pratiche è il più delicato.

Prima dell'unione Pratix deve mostrare un riepilogo esplicito di cosa verrebbe
spostato:

- Attività;
- allegati;
- Fatture;
- storico stati;
- cessioni credito;
- dati principali della Pratica;
- note.

Se ci sono conflitti forti, il merge automatico deve bloccarsi e lasciare
all'utente solo il confronto o una risoluzione manuale.

## Avviso prima della creazione

Nei form di creazione Pratix deve controllare potenziali duplicati prima del
salvataggio per:

- Committente;
- Cliente;
- Controparte;
- Pratica.

Se trova candidati, mostra un avviso nel form con:

- messaggio chiaro, ad esempio `Potrebbe già esistere un Cliente simile`;
- lista dei record sospetti;
- motivo del sospetto;
- probabilità;
- azioni disponibili.

Azioni nel form:

- `Usa esistente`;
- `Apri confronto`;
- `Crea comunque`.

Le creazioni rapide dentro il form Pratica sono una superficie prioritaria,
perché oggi permettono di creare al volo Committente, Cliente e Controparte
minimi. Il controllo preventivo deve coprire anche quei flussi.

## Dati da salvare

Serve una tabella dedicata alle decisioni sui duplicati, ad esempio
`duplicate_reviews`.

Campi previsti:

- `id`;
- `user_id`;
- tipo entità;
- record A;
- record B;
- score o probabilità;
- motivi del match;
- stato: open, snoozed, dismissed, merged;
- record mantenuto, se unito;
- record assorbito, se unito;
- data rilevazione;
- data risoluzione;
- nota opzionale;
- snapshot minimo dei motivi, utile a capire perché la coppia era stata
  proposta.

Le decisioni `dismissed` o "non duplicato" devono impedire che la stessa coppia
venga riproposta senza motivo.

## Approccio tecnico consigliato

Prima versione:

- matching calcolato lato applicazione/server function;
- nessun cron;
- nessuna nuova dipendenza pesante se non necessaria;
- normalizzazione testuale in una libreria dedicata e testabile;
- query Supabase owner-scoped;
- salvataggio decisioni in tabella con RLS;
- merge tramite funzioni server o RPC controllate, non logica sparsa nei
  componenti.

Componenti probabili:

- libreria matching duplicati;
- server function `scanDuplicateCandidates`;
- server function `resolveDuplicateCandidate`;
- server function o RPC per merge prudente;
- nuova route `/controllo-duplicati`;
- componenti di lista, confronto e risoluzione;
- integrazione nei form esistenti.

## Sicurezza e RLS

Ogni nuova tabella user-owned deve avere:

- `user_id uuid not null`;
- RLS attiva;
- policy `select`, `insert`, `update`, `delete` basate su
  `(select auth.uid()) = user_id`.

Le funzioni di merge devono impedire collegamenti cross-user. Ogni update deve
restare nel perimetro dell'utente autenticato.

Nessun dato sensibile va stampato in log, errori o screenshot. Le schermate di
confronto devono mostrare solo dati dell'utente autenticato.

## Documentazione e versioning

Questa pianificazione è documentazione interna e non richiede release SemVer.

Quando la funzionalità verrà implementata, essendo utente-visibile, servirà:

- aggiornare `ROADMAP.md`;
- aggiornare `CHANGELOG.md` sotto `[Non rilasciato] > Novità`;
- valutare bump MINOR al rilascio;
- aggiornare `docs/data-model.md` se viene aggiunta `duplicate_reviews`;
- aggiornare `supabase/schema.sql` e migrations se cambia il modello dati.

## Verifiche previste per l'implementazione

Verifiche minime:

- test unitari sulla normalizzazione nomi/ragioni sociali;
- test matching Committenti;
- test matching Clienti;
- test matching Controparti;
- test matching Pratiche;
- test che una coppia segnata come non duplicato non venga riproposta;
- test merge con spostamento collegamenti;
- test form: avviso mostrato prima della creazione;
- test schema/RLS per la nuova tabella;
- `npm run lint`;
- `npm run build`;
- per UI sostanziale, `npm run smoke:a11y`.

## Sequenza implementativa consigliata

1. Aggiungere schema e tabella decisioni duplicati.
2. Implementare normalizzazione e scoring.
3. Implementare scansione candidati per Committenti, Clienti, Controparti e
   Pratiche.
4. Creare pagina `/controllo-duplicati`.
5. Implementare confronto e stati: rimandato, non duplicato, risolto.
6. Implementare merge prudente per Committenti, Clienti e Controparti.
7. Implementare merge prudente per Pratiche con riepilogo più rigoroso.
8. Integrare avviso preventivo nei form e nelle creazioni rapide da Pratica.
9. Aggiornare roadmap, changelog e documentazione dati.
10. Eseguire verifiche e smoke UI.

## Decisioni approvate

- Nome UI: `Controllo duplicati`.
- Route: `/controllo-duplicati`.
- Voce autonoma in sidebar.
- Controllo all'apertura pagina.
- Pulsante `Ricontrolla`.
- Copertura iniziale su Committenti, Clienti, Controparti e Pratiche.
- La funzionalità deve anche risolvere, non solo segnalare.
- Matching basato soprattutto su nomi, cognomi, ragioni sociali e contesto
  operativo.
- Codice fiscale, partita IVA, PEC ed email sono segnali secondari.
- Salvare le decisioni "non duplicato".
- Merge prudente.
- Record perdente eliminato solo se quasi vuoto e senza storico.
- Mostrare sempre il motivo del sospetto.
- Niente controlli ricorrenti in background nella prima versione: ricalcolo solo
  all'apertura della pagina e con `Ricontrolla`.
