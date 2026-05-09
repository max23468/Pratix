# Piano — Strategia test automatizzati progressiva

- **Stato**: target ideale operativo raggiunto
- **Data**: 2026-05-09
- **Ambito**: introdurre test automatici proporzionati ai rischi reali di Pratix
- **Tipo modifica attesa**: non versionato finché aggiunge solo copertura e processo

## Obiettivo

Costruire una suite progressiva che protegga i flussi critici senza rendere il
lavoro quotidiano lento o fragile.

Il primo livello copre logica pura e deterministica. I livelli successivi
aggiungono integrazione Supabase, smoke browser e verifiche manuali guidate solo
quando servono davvero.

## Stack scelto

1. **Vitest** per unit test TypeScript su logica pura.
2. **`npm test`** come comando standard per la suite automatizzata.
3. **`npm run test:coverage`** con provider V8 per misurare la copertura
   operativa senza usare il pacchetto deprecated `istanbul`.
4. **`npm run test:coverage:global`** come indicatore secondario su tutto `src`
   utile a capire il debito complessivo, non come gate principale.
5. **Quality GitHub** e **pre-push guard** come punti di ingresso graduali.
6. Browser Use o Safari/Computer Use solo per smoke autenticati e collaudi UI,
   non per test unitari.

## Livelli di copertura

### Livello 1 — Unit test puri

Stato: avviato.

Copre funzioni senza rete, Supabase, browser o storage:

- calcoli fattura in `src/lib/invoice-calc.ts`;
- generazione XML FatturaPA in `src/lib/invoice-xml.ts`;
- helper storage path per fatture, allegati e rendiconti;
- rendiconti Excel generati in memoria;
- template prezzi recupero crediti;
- parser changelog, formattazione e label operative;
- schemi auth usati da login, registrazione e recupero password;
- parser e helper Excel/import quando isolabili.

Gate: `npm test`.

### Livello 2 — Integration test leggeri

Stato: da impostare dopo il primo livello.

Copre contratti server-side con fixture anonime e database controllato:

- numero pratica progressivo;
- snapshot prezzi sulle attività;
- blocco attività già fatturate;
- rinvio attività fra periodi;
- RPC `apply_import_row`;
- policy RLS essenziali.

Questi test non devono usare dati reali e non devono richiedere segreti
committati. Se richiedono Supabase remoto o locale, vanno documentati con env
dedicati e skip esplicito quando l'ambiente non è disponibile.

### Livello 3 — Smoke autenticati

Stato: manuale/assistito per ora.

Copre i flussi che il professionista usa davvero:

- login e redirect auth;
- dashboard;
- Pratiche, Attività, Committenti, Clienti e Controparti;
- fattura da committente/periodo;
- dettaglio fattura, PDF, XML e rendiconti Excel;
- import archivio con allegati e fatturazione successiva.

Si eseguono con account/fixture di test riconoscibili e dati anonimi.

## Baseline 2026-05-09

La baseline iniziale introduce:

- `vitest` come dev dependency;
- `@vitest/coverage-v8` come provider coverage;
- `npm test`;
- `npm run test:coverage`;
- `npm run test:coverage:global`;
- 39 test unitari distribuiti su 10 file;
- test unitari su `computeInvoice`;
- test unitari su XML FatturaPA, path Storage, template prezzi e
  rendiconti Excel;
- test unitari su parser changelog, formattazione, label operative di
  Pratiche/Attività, schemi auth e helper server di fatturazione;
- esecuzione test in `npm run ci:local`;
- esecuzione test nel workflow Quality;
- esecuzione test nel pre-push guard quando cambiano sorgenti o test.

Coverage V8 sul perimetro `src/lib` dopo la prima baseline:

- Statements: 42,73% (247/578)
- Branches: 48,75% (176/361)
- Functions: 46,07% (47/102)
- Lines: 42,60% (219/514)

Coverage V8 sul perimetro esteso precedente `src/lib` + `src/server`:

- Statements: 35,43% (258/728)
- Branches: 37,02% (184/497)
- Functions: 39,20% (49/125)
- Lines: 36,06% (229/635)

Coverage V8 operativa configurata dopo l'estensione ai primi quattro perimetri:

- Statements: 15,13% (267/1764)
- Branches: 12,84% (190/1479)
- Functions: 10,40% (51/490)
- Lines: 15,62% (238/1523)

Questo è il numero principale da usare durante il lavoro sui test. Include
`src/lib`, `src/server`, `src/hooks` e i componenti applicativi non-ui con
logica reale. Esclude test, `src/lib/version.ts`, `src/components/ui/**`,
`src/components/brand/**` e componenti presentazionali puri come layout, empty
state, pagina header e card di aspetto, perché falserebbero il segnale.

Coverage V8 globale secondaria:

- Statements: 7,67% (267/3481)
- Branches: 6,06% (190/3135)
- Functions: 4,89% (51/1041)
- Lines: 7,92% (238/3003)

La globale include quasi tutto `src` e serve a misurare il debito complessivo.
Esclude solo test, `src/routeTree.gen.ts`, tipi Supabase generati,
`src/lib/version.ts`, `src/main.tsx` e `src/components/ui/**`.

## Target coverage

La soglia ideale per Pratix non è 100%: sarebbe costosa e spingerebbe a testare
troppo markup o dettagli fragili. Il target corretto è proteggere bene dominio,
fatturazione, import, auth e server function, lasciando la UI presentazionale a
smoke test e verifiche browser.

### Target principale operativo

Questo è il target da usare come riferimento di lavoro su `npm run
test:coverage`.

| Orizzonte                    |  Lines | Statements | Branches | Functions | Uso                                                                  |
| ---------------------------- | -----: | ---------: | -------: | --------: | -------------------------------------------------------------------- |
| Baseline corrente            | 15,62% |     15,13% |   12,84% |    10,40% | Punto di partenza dopo l'estensione del perimetro                    |
| Soglia minima da raggiungere |    50% |        50% |      40% |       45% | Sufficiente per dire che la suite protegge il nucleo operativo       |
| Target ideale                |    75% |        75% |      65% |       70% | Stato maturo per Pratix senza rendere i test sproporzionati          |
| Area critica                 | 85-90% |     85-90% |      80% |    85-90% | Calcoli fiscali, XML, rendiconti, import, fatturazione e validazioni |

Quando la coverage principale arriva stabilmente almeno al 50%, la regola
operativa diventa: ogni modifica su logica critica deve aggiungere test o
motivare perché non serve; ogni PR non deve abbassare sensibilmente il trend.

### Target globale secondario

La globale non deve diventare il gate principale, perché include route e UI che
si coprono meglio con smoke/e2e. Serve però a non perdere di vista il debito
complessivo.

| Orizzonte         | Lines | Uso                                                           |
| ----------------- | ----: | ------------------------------------------------------------- |
| Baseline corrente | 7,92% | Punto di partenza reale su quasi tutto `src`                  |
| Primo obiettivo   |   25% | Dopo helper import, server function e primi smoke/integration |
| Target ideale     |   45% | Buon equilibrio per SaaS leggero con UI ampia                 |
| Long term         |   55% | Solo se i flussi principali diventano stabili e poco costosi  |

La globale non va inseguita testando componenti statici o file generati. Deve
salire soprattutto per estrazione di helper puri, integration test Supabase e
smoke test sui flussi autenticati principali.

I principali buchi rimasti sono `invoice-pdf.ts`, `xlsx.ts`, contesti React,
hook, componenti applicativi non-ui, route UI e soprattutto
`src/server/invoices.functions.ts`, che richiede integration test o ulteriore
estrazione di helper puri per essere coperto in modo utile.

## Incremento 2026-05-09 — coverage recupero crediti

Questo incremento ha portato la suite a 107 test distribuiti su 37 file,
aggiungendo:

- test PDF fattura, inclusi regime forfettario fallback e output multipagina;
- test parser Excel su shared strings, inline strings, celle numeriche, foglio
  fallback e input non validi;
- smoke render SSR per form, navigazione, onboarding, Turnstile e tab Attività;
- test interattivi jsdom sulle validazioni principali di Committenti, Clienti,
  Controparti, Pratiche, Prezzi e Fatture;
- test su AuthProvider, hook novità, layout app, onboarding, menu utente, tema,
  apertura allegati e registrazione di una voce Attività;
- test smoke su componenti presentazionali globali, logo, route privacy/termini,
  configurazione router e QueryClient;
- helper puri per la logica di fatturazione committente/periodo, coprendo
  selezione attività, rinvii, blocco attività già fatturate, righe fattura,
  righe rendiconto e fallback del soggetto fatturato.

Coverage V8 operativa dopo l'incremento:

- Statements: 79,11% (1413/1786)
- Branches: 70,81% (1053/1487)
- Functions: 70,23% (354/504)
- Lines: 84,36% (1300/1541)

Coverage V8 globale secondaria dopo l'incremento:

- Statements: 42,18% (1477/3501)
- Branches: 35,75% (1123/3141)
- Functions: 35,73% (377/1055)
- Lines: 45,12% (1362/3018)

Il target ideale operativo e il target globale secondario sono raggiunti.
Restano fuori dal perimetro di questa tranche i test end-to-end su import con
allegati, fatturazione successiva e integrazione Supabase/RLS: vanno trattati
come prossimi incrementi con fixture anonime e ambiente dedicato.

## Prossimi incrementi

1. Estrarre helper import testabili da `src/routes/import-archivio.tsx`, se
   serve coprire parsing e validazioni senza browser.
2. Coprire numero pratica, snapshot prezzi e conferma import con fixture
   anonime.
3. Aggiungere fixture anonime per flussi recupero crediti.
4. Definire il perimetro integration Supabase, distinguendo test locali,
   remoto controllato e smoke production.
5. Valutare Playwright solo quando i flussi UI diventano abbastanza stabili da
   giustificare manutenzione e tempi di CI.
