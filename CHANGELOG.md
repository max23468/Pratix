# Changelog

Tutte le modifiche significative a Pratix sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il versionamento aderisce a [Semantic Versioning](https://semver.org/lang/it/).

## [Non rilasciato]

### Non versionato

- **Documentazione**: riallineate istruzioni operative, guide, roadmap e glossario allo stato pubblicato fino a Pratix 1.4.0.

## [1.4.0] — 2026-05-16

### Novità

- **Fatturazione**: aggiunto nelle Impostazioni il toggle per includere il bollo in fattura, disattivo di default.

## [1.3.4] — 2026-05-16

### Correzioni

- **Menu account**: il pannellino in alto a destra ora espone solo le cinque sezioni di `/account`: Profilo, Accesso e sicurezza, Aspetto, Notifiche e Dati.

## [1.3.3] — 2026-05-16

### Correzioni

- **Creazione guidata**: rimossa la funzione di import Excel strutturato; la procedura manuale passa alla route `/creazione-guidata`, resta disponibile dalla dashboard e non compare più nella sezione Account.

## [1.3.2] — 2026-05-16

### Correzioni

- **Fatture**: la creazione distingue fra "Salva bozza" e "Crea fattura"; dal dettaglio una bozza può essere segnata come emessa prima di essere segnata pagata.

## [1.3.1] — 2026-05-16

### Correzioni

- **Passkey**: nascosto l'accesso rapido dietro feature flag finché Supabase Auth non rende disponibile la configurazione WebAuthn sul progetto hosted; il link via email resta il flusso gratuito stabile.

## [1.3.0] — 2026-05-16

### Novità

- **Accesso senza password**: login e registrazione usano link sicuri via email; l'area Account può aggiungere e rimuovere passkey come accesso rapido.

### Correzioni

- **Area Account**: rimosse le azioni di cambio e recupero password dalla UI; cambio email ed eliminazione account restano protetti da sessione attiva e conferma esplicita.

### Sotto il cofano

- **Supabase Auth**: tracciato il template Magic Link italiano e allineata la configurazione remota Auth senza reintrodurre password nella UI.
- **Smoke autenticato**: `npm run smoke:a11y` usa un magic link Supabase generato server-side quando è presente la service role key locale, senza dipendere da password tradizionali.

## [1.2.19] — 2026-05-16

### Correzioni

- **Rendiconti Excel**: riallineati i tracciati generati ai template onorari e rimborsi spese ricevuti, mantenendo la compatibilità dei file `.xlsx`.

## [1.2.18] — 2026-05-16

### Correzioni

- **Rendiconti Excel**: i bottoni nel dettaglio Fattura rigenerano file `.xlsx` compatibili al download, evitando di servire rendiconti storici salvati in formato fragile.

## [1.2.17] — 2026-05-16

### Correzioni

- **Dashboard**: rimossi i bottoni rapidi Fattura e Attività dall'header, lasciando intatte le altre vie di accesso.

## [1.2.16] — 2026-05-16

### Correzioni

- **Rendiconti Excel**: chiarita la generazione insieme alla Fattura, ripristinato il download dei rendiconti salvati e compattati i nomi file nei bottoni.

## [1.2.15] — 2026-05-16

### Correzioni

- **URL leggibili**: impedito il riuso dei codici pubblici dopo la cancellazione di clienti, committenti, controparti, pratiche, prezzi o fatture.

## [1.2.14] — 2026-05-16

### Sotto il cofano

- **Schema**: sincronizzati i codici pubblici stabili per URL leggibili su anagrafiche, pratiche, prezzi e fatture, con tipi Supabase rigenerati.

## [1.2.13] — 2026-05-16

### Correzioni

- **Clienti**: rimossi i campi fiscali e di fatturazione elettronica dall'anagrafica cliente; la fattura resta emessa solo al committente.

### Sotto il cofano

- **Schema**: aggiunta la migration che elimina da `clients` i campi legacy `tax_code`, `vat_number`, `pec` e `sdi_code`.

## [1.2.12] — 2026-05-16

### Correzioni

- **Pratiche**: nel dettaglio pratica lo stato appare accanto al titolo, separato dalle azioni di creazione e ritorno.

## [1.2.11] — 2026-05-16

### Correzioni

- **Cruscotto pratica**: le priorità sono rinominate in "Richiede intervento", "Da monitorare" e "Regolare"; il badge di intervento apre una spiegazione contestuale con il motivo specifico.

## [1.2.10] — 2026-05-16

### Correzioni

- **Navigazione**: i pulsanti header indicano la sezione di ritorno invece del generico "Indietro".

## [1.2.9] — 2026-05-16

### Correzioni

- **Clienti**: il salvataggio richiede almeno un committente collegato e mostra un avviso se il collegamento manca.

## [1.2.8] — 2026-05-16

### Correzioni

- **Dashboard mobile**: le card KPI usano un layout mobile più compatto per evitare troncamenti anche sulle larghezze più strette.

## [1.2.7] — 2026-05-16

### Correzioni

- **Fatture**: il riepilogo non mostra più la riga IVA per i profili in regime forfettario.

## [1.2.6] — 2026-05-16

### Correzioni

- **Fatture**: le spese generali sono attive di default nella creazione fattura.

## [1.2.5] — 2026-05-16

### Correzioni

- **Dashboard mobile**: rimossa l'azione rapida Prezzi dall'header, verificata la leggibilità degli otto KPI principali su iPhone e allineato il conteggio delle Fatture scadute alla data locale.

## [1.2.4] — 2026-05-16

### Correzioni

- **Dashboard**: i KPI principali ora usano una griglia 4x2 su desktop e 2x4 su mobile, con pratiche senza attività, pratiche da completare, fatture e rimborsi operativi al posto del riepilogo chiuse/archiviate.
- **Form**: i submit ripetuti durante un salvataggio non creano più duplicati nelle anagrafiche, nelle pratiche, nelle attività, nei prezzi e nelle fatture.

## [1.2.3] — 2026-05-16

### Correzioni

- **Fatture mobile**: la creazione di una nuova Fattura resta leggibile su iPhone e il dialog delle modifiche non salvate separa meglio i pulsanti.

## [1.2.2] — 2026-05-16

### Correzioni

- **Dashboard**: il pulsante primario `+ Crea` apre ora un menu per scegliere se creare Pratica, Committente, Cliente, Controparte, Fattura, Prezzi o importare un archivio.

## [1.2.1] — 2026-05-16

### Correzioni

- **Form**: il guard delle modifiche non salvate non compare più subito dopo aver premuto Salva o durante il caricamento iniziale di una Pratica.

## [1.2.0] — 2026-05-16

### Novità

- **Liste ordinabili**: le colonne principali delle sezioni operative diventano ordinabili e ricordano l'ultimo ordinamento dell'utente fra dispositivi.

## [1.1.5] — 2026-05-16

### Correzioni

- **Novità**: ogni versione rilasciata ha un box dedicato, le voci sono raggruppate per area e le versioni pre-1.0 sono raccolte in una sezione chiusa di default.

## [1.1.4] — 2026-05-16

### Correzioni

- **Attività**: le voci non collegate a una Fattura si possono modificare anche dalla lista globale `/attivita`.
- **Attività**: il salvataggio della modifica si interrompe se la voce viene collegata a una Fattura mentre il dialog è aperto.

## [1.1.3] — 2026-05-16

### Correzioni

- **Liste**: corretto il click sulla riga intera, evitando che la selezione apra sempre l'ultimo elemento della tabella.

## [1.1.2] — 2026-05-16

### Correzioni

- **Dettaglio Pratica**: riordinati i box principali con azioni rapide, cruscotto, dati, riferimenti, timeline, scheda economica e controlli qualità; rimossa la sezione separata "Dossier esportabile".
- **Timeline pratica**: le Attività incluse nella timeline aprono la modifica della voce fatturabile al click.
- **Attività**: le righe collegate a una Pratica sono selezionabili su tutta la larghezza.
- **Form**: i form principali avvisano quando si prova a tornare indietro con modifiche non salvate e offrono di salvare prima di lasciare la pagina.
- **Attività**: i codici interni dei prezzi restano visibili solo nella sezione Prezzi e nelle altre viste vengono sostituiti dal nome della voce.
- **Impostazioni**: la tab fiscale usa il titolo "Fiscalità".
- **Impostazioni**: rimossa la sezione "Recupero crediti" dalla tab Fatturazione.
- **Impostazioni**: la tab Professione ora usa il titolo più esplicito "Dati professionali".
- **Menu utente**: la scorciatoia alle impostazioni usa il titolo "Impostazioni".

## [1.1.1] — 2026-05-16

### Correzioni

- **Attività**: le voci non collegate a una Fattura si possono modificare dal dettaglio Pratica.

## [1.1.0] — 2026-05-16

### Novità

- **Pratiche**: dalla creazione di una Pratica si possono creare al volo anagrafiche minime di Committente, Cliente e Controparte, poi salvarle già collegate.

### Correzioni

- **Cruscotto pratica**: il badge mostra "Priorità alta" e apre una spiegazione contestuale con il motivo specifico della priorità.
- **Fatture**: la Cassa Forense viene calcolata anche in regime forfettario sui compensi; le spese imponibili legacy entrano nella base cassa e i rimborsi Art. 15 restano esclusi.
- **Import archivio**: il riconoscimento delle Controparti persona fisica resta compatibile con i file che usano l'ordine nome-cognome.
- **Liste**: le righe di Clienti, Committenti, Controparti, Pratiche, Prezzi e Fatture sono selezionabili su tutta la larghezza.

## [1.0.2] — 2026-05-15

### Correzioni

- **Controparti**: le persone fisiche mostrano e ordinano il nome come cognome seguito dal nome.

## [1.0.1] — 2026-05-15

### Correzioni

- **Creazione rapida continuativa**: dopo aver creato Committenti, Clienti, Controparti, Pratiche, Prezzi o Fatture, il dettaglio mostra subito l'azione per inserirne un altro senza tornare all'elenco.

## [1.0.0] — 2026-05-09

### Novità

- **Pratix 1.0**: promosso il perimetro stabile del gestionale per avvocati freelance centrato su recupero crediti, con Pratiche, Committenti, Clienti, Controparti, Attività, Prezzi, Fatture, import, export, dossier e verifiche produzione completate.

### Correzioni

- **Import Excel**: la validazione aspetta sempre il lookup delle Pratiche esistenti e consente di ritentare se il caricamento iniziale fallisce.
- **Dossier Pratica**: i download dal cruscotto restano disabilitati anche durante il refresh dei dati di Attività, Fatture, storico e cessioni.
- **Workflow recupero crediti**: il calcolo delle Fatture insolute confronta solo la data di calendario, evitando anticipi legati a timestamp o fusi orari.

## [Non versionato] — 2026-05-09

### Non versionato

- **Piano Pratix 1.0 readiness**: definita la checklist operativa per congelare il perimetro, verificare produzione e promuovere la release `1.0.0` senza aprire nuove macro-feature.
- **Fase 0 readiness 1.0**: confermato che le voci parcheggiate restano post-1.0 e che il blocco `[Non rilasciato]` non richiede una release intermedia.
- **Fase 1 readiness 1.0**: registrati i gate locali verdi e il dry-run Supabase completato con database remoto allineato.
- **Fase 2 readiness 1.0**: completato lo smoke produzione pubblico e autenticato, con fixture recupero crediti, download, export dati e Vercel verificati senza bug bloccanti.
- **Fase 4 readiness 1.0**: preparata la release `1.0.0` con React Doctor major, gate locali, smoke a11y, dry-run Supabase e verifica `Codex feedback inbox`.
- **Chiusura operativa readiness 1.0**: aggiornato lo stato finale post-merge con release `1.0.0` pubblicata, deployment production verificato, dry-run Supabase finale e smoke autenticato mirato completati.

## [0.20.1] — 2026-05-09

### Correzioni

- **Import Excel**: la validazione attende il caricamento delle pratiche esistenti prima di calcolare righe da creare o aggiornare.
- **Dossier pratica**: i download Excel/PDF restano bloccati anche da handler mentre i dati del dossier sono in caricamento.
- **Workflow recupero crediti**: le Fatture emesse diventano insolute solo dal giorno successivo alla scadenza.

### Sotto il cofano

- **Asset logo export/press**: aggiunti i loghi statici orizzontale scuro su panna e monocromatico, generabili con `npm run brand:assets`.

## [Non versionato] — 2026-05-09

### Non versionato

- **Roadmap prodotto**: rimossa la pagina `/brand` dalle cose da fare e segnata come completata la dismissione definitiva di Lovable.

## [0.20.0] — 2026-05-09

### Novità

- **Workflow recupero crediti**: il cruscotto Pratica ora mostra stato operativo, priorità, prossima azione e motivo calcolati da Attività, Fatture e qualità dati.
- **Aggiornamento reale da import**: le righe Excel su pratiche già presenti aggiornano la Pratica esistente e aggiungono solo Attività non già registrate.

## [0.19.0] — 2026-05-09

### Novità

- **Azioni rapide Pratica**: aggiunti comandi diretti per registrare Attività, creare Fatture, aprire l'import archivio ed esportare dossier dal dettaglio Pratica.
- **Scheda economica Pratica**: il dettaglio Pratica ora mostra compensi, rimborsi spese, maturato, fatturato, incassato e residuo operativo.
- **Dossier PDF**: aggiunto un export PDF leggibile del dossier pratica accanto all'Excel.
- **Import incrementale**: l'anteprima Excel distingue righe da creare, pratiche già presenti da aggiornare manualmente e righe duplicate da ignorare prima dello staging.
- **Controlli qualità dati**: il dettaglio Pratica segnala soggetti mancanti, Attività senza allegati, importi da fatturare e Fatture in bozza.

## [0.18.0] — 2026-05-09

### Novità

- **Cruscotto pratica**: il dettaglio Pratica ora mostra soggetti, importi da fatturare, fatture collegate, allegati e prossima azione consigliata.
- **Timeline pratica**: aggiunta una vista cronologica con apertura pratica, Attività, allegati, Fatture, cessioni credito e cambi di stato.
- **Dossier pratica**: aggiunto download Excel riepilogativo con soggetti, Attività, allegati, Fatture e storico operativo.

## [0.17.0] — 2026-05-09

### Novità

- **Ricerca globale**: aggiunta una command palette nella topbar per cercare Pratiche, Clienti e Fatture, con azioni rapide per nuova pratica, nuovo cliente, nuova fattura e Attività.
- **Scorciatoie tastiera**: aggiunti `Cmd/Ctrl+K` per la ricerca globale e scorciatoie dirette per nuova pratica, nuovo cliente e nuova fattura.
- **JSON-LD pubblico**: aggiunti structured data `Organization` e `SoftwareApplication` con logo, versione e offerta iniziale gratuita.

## [0.16.0] — 2026-05-09

### Novità

- **Landing pubblica**: aggiunte sezioni "Perché Pratix", mockup prodotto, pricing della fase iniziale e FAQ orientate al recupero crediti.

### Correzioni

- **Stati vuoti e microcopy**: uniformati Dashboard, Pratiche, Clienti, Fatture e Attività con messaggi e azioni contestuali coerenti con il glossario.

### Sotto il cofano

- **Audit dipendenze**: eseguito `npm audit --audit-level=moderate` senza vulnerabilità.

## [0.15.0] — 2026-05-09

### Novità

- **Filtri persistenti**: le viste Attività e Fatture mantengono ricerca, stato, tipo, anno e periodo nell'URL, così si possono ricaricare, ritrovare tornando alla pagina o condividere.

## [0.14.0] — 2026-05-09

### Novità

- **Dashboard operativa**: aggiunta una sezione di azioni rapide per controllare attività da fatturare, preparare una fattura e importare nuove pratiche dall'archivio.

### Correzioni

- **Impostazioni**: associati esplicitamente i campi di anagrafica, fiscalità, pagamenti e fatturazione alle rispettive label, migliorando la navigazione assistiva.

### Sotto il cofano

- **Smoke accessibilità WebKit**: aggiunto `npm run smoke:a11y` con Playwright WebKit e `axe-core` per controllare route pubbliche e autenticate in chiaro/scuro su desktop, tablet e mobile.

## [0.13.3] — 2026-05-09

### Correzioni

- **Accessibilità**: completato l'audit WCAG AA WebKit sui temi chiaro/scuro, correggendo contrasto della terracotta, link legali, filtri senza nome accessibile e label dei form account/impostazioni/fatture/import.

## [0.13.2] — 2026-05-09

### Correzioni

- **Account**: la cancellazione account completa la rimozione Auth anche se la pulizia Storage incontra un errore transitorio, evitando account attivi senza dati applicativi; l'export dati personali pagina con ordinamento deterministico per `id`.

## [0.13.1] — 2026-05-09

### Correzioni

- **Account**: resa più sicura la cancellazione account eliminando prima le righe applicative in ordine coerente con le FK e poi gli oggetti Storage; l'export dati personali ora pagina le tabelle Supabase per non omettere righe oltre il limite di risposta.

## [0.13.0] — 2026-05-09

### Novità

- **Export massivo fatture**: dalla lista fatture si può scaricare uno ZIP con PDF di cortesia e XML SdI delle fatture filtrate per stato, anno, ricerca e periodo.
- **Account e dati personali**: aggiunti cambio email con conferma Supabase, export dati JSON/CSV e cancellazione account con rimozione degli oggetti Storage collegati.

### Sotto il cofano

- **Contratti Supabase/RLS**: aggiunti test su RPC import, policy owner-scoped, Storage privato e helper di export con fixture anonime.
- **Accessibilità**: rispettato `prefers-reduced-motion` per ridurre animazioni e transizioni non essenziali.

## [0.12.9] — 2026-05-09

### Correzioni

- **Import archivio Excel**: normalizzate le colonne vuote intermedie come celle vuote, evitando righe sparse nella mappatura dell'anteprima.
- **Prezzi**: assegnati id univoci agli switch di visibilità delle voci non ancora salvate.

## [0.12.8] — 2026-05-09

### Sotto il cofano

- **React Doctor 100/100**: aggiunta la configurazione di baseline, documentata la soglia operativa e corretti warning sicuri su classi Tailwind, contesti React 19, accessibilità e micro-performance.

## [0.12.7] — 2026-05-09

### Correzioni

- **Accesso**: pulita automaticamente la sessione locale quando Supabase trova un refresh token non più valido, evitando errori console dopo la rimozione di un utente test o sessioni scadute.

## [Non versionato] — 2026-05-09

### Non versionato

- **Smoke autenticato Pratix**: confermato l'account test Supabase riusabile e documentato il collaudo produzione con import, allegato attività, fattura successiva e rendiconti Excel su fixture anonime.
- **Gate React Doctor major release**: aggiunto un controllo React Doctor offline e bloccante solo per diagnostiche `error` quando si prepara una release major.
- **Strategia test automatizzati**: aggiunto Vitest, `npm test`, `npm run test:coverage`, `npm run test:coverage:global`, target coverage progressivi, piano operativo e prima copertura su calcoli fiscali, XML FatturaPA, path Storage, template Prezzi, rendiconti Excel, changelog, formattazione, label operative, schemi auth e helper server di fatturazione.
- **Incremento coverage recupero crediti**: estesa la suite Vitest a PDF fatture, parser Excel, logica server di fatturazione, auth, onboarding, attività, form recupero crediti, smoke render dei componenti applicativi e route pubbliche, raggiungendo i target coverage definiti in roadmap.
- **Roadmap collaudo import**: segnato come parzialmente completato il test semi-reale del flusso import, mantenendo allegati e fatturazione successiva come residui espliciti.
- **Piano update latest dipendenze**: allineati stato finale e prossimi passi del piano dopo la pubblicazione delle release e la verifica produzione.
- **Chiusura piano update latest dipendenze**: aggiornato il piano con PR mergeate, release `0.12.5`/`0.12.6`, produzione Vercel verificata e smoke autenticati Browser Use completati.

## [0.12.6] — 2026-05-09

### Correzioni

- **Fatture**: corretta l'apertura di `/fatture/nuova`, evitando un ciclo di rendering quando non è ancora selezionato un committente, leggendo le aliquote fiscali dai campi profilo corretti e inviando l'autorizzazione alle server function di generazione fattura/XML.

## [0.12.5] — 2026-05-09

### Correzioni

- **Novità**: esclusi i blocchi `Non versionato` dalla lista pubblica delle release mostrate nella pagina `/novita`.

### Sotto il cofano

- Aggiornate le prime dipendenze latest e la toolchain Vite/TypeScript/ESLint; rimossa la dipendenza `vite-tsconfig-paths` ora coperta dalla risoluzione nativa di Vite.
- Aggiornati i major runtime/UI di supporto (`zod`, `react-day-picker`, `recharts` e `lucide-react`) alle versioni latest, mantenendo compatibili validazioni, calendari, grafici e icone.
- Resi cross-platform gli script npm `dev`, `build`, `build:dev` e `preview` tramite wrapper Node per Vite.

## [Non versionato] — 2026-05-08

### Non versionato

- **Chiusura piano recupero crediti**: aggiornato il piano di evoluzione per segnare la chiusura lato prodotto delle Fasi 1-8 e spostare in roadmap i residui non bloccanti.
- **Piano update latest dipendenze**: definito il percorso operativo per aggiornare Pratix alle versioni latest assolute di dipendenze, toolchain, CLI e runtime, con verifica Node 24/26 e gate Vercel/Supabase.
- **Verifica shadcn/Radix update latest**: completata la Fase 4 del piano senza overwrite massivo dei componenti, perché la registry latest propone diff non funzionali e dipendenze non coerenti con l'update già applicato.
- **Verifica CLI Supabase/Vercel latest**: completata la Fase 5 del piano mantenendo le CLI operative via `npx`, senza pinning in `devDependencies`, e tracciando il warning Vercel CLI su Node 26 come punto da chiudere con la verifica Node 24/Vercel.
- **Allineamento CI Node 24**: completata la Fase 5B del piano dichiarando `packageManager`/`engines`, portando i workflow GitHub a Node 24 e verificando build/lint anche con Node 24 reale.
- **Verifiche applicative update latest**: completata la Fase 6 del piano con gate locali, preview browser, smoke pubblico/mobile, tema chiaro/scuro, form auth pubblici e redirect delle route protette non autenticate.

## [0.12.4] — 2026-05-08

### Sotto il cofano

- Aggiornate le dipendenze Tailwind/TanStack/Vite entro major compatibili e aggiunto uno shim Node per evitare il warning `DEP0205` sul loader Tailwind con Node 26.

## [0.12.3] — 2026-05-08

### Correzioni

- **Import archivio Excel**: quando un import è parziale, il pulsante segnala "Import parziale" e mostra un avviso persistente invece di indicare l'import come completato.

## [0.12.2] — 2026-05-08

### Correzioni

- **Import archivio Excel**: dopo l'import di una preview, il relativo staging non può essere preparato di nuovo senza rivalidare il file.

## [0.12.1] — 2026-05-08

### Correzioni

- **Fatture**: aumentato lo spazio tra i riepiloghi degli importi e la tabella sottostante.

## [0.12.0] — 2026-05-08

### Novità

- **Fase 8 superfici trasversali completata**: dashboard riallineata a pratiche, attività da fatturare, committenti e rimborsi senza allegato; filtri, viste operative, empty state, Account, Impostazioni, Novità, onboarding, landing e documenti pubblici aggiornati al dominio recupero crediti.
- **Export dati essenziali**: dall'Account si può scaricare un archivio JSON con anagrafiche, pratiche, attività, prezzi e fatture.

### Correzioni

- **Import archivio Excel**: dopo la conferma le righe già importate non possono essere importate una seconda volta dalla stessa anteprima.

## [0.11.0] — 2026-05-08

### Novità

- **Import archivio Fase 7 completato**: aggiunti upload `.xlsx`, mappatura colonne, validazione massiva, staging, import delle righe valide e allegati sulle attività storiche dalla procedura guidata.

### Sotto il cofano

- **Conferma import transazionale**: spostata la conferma delle righe di import in RPC Postgres `apply_import_row`, così pratica, collegamenti, attività e udienze vengono create in un'unica transazione per riga.
- **Validazione date udienza**: bloccate date udienza duplicate prima del salvataggio di attività e import, evitando errori sui vincoli database.

## [0.10.0] — 2026-05-08

### Novità

- **Import archivio guidato avviato**: aggiunta una procedura manuale dal menu Account per trascrivere una pratica da archivio cartaceo, preparare un'anteprima in staging e confermare solo alla fine la creazione di pratica e attività.

## [0.9.0] — 2026-05-08

### Novità

- **Fatturazione committente/periodo Fase 6**: il nuovo flusso fatture estrae le attività da fatturare per committente e periodo, permette di includerle, rinviarle o escluderle, genera la fattura verso il committente e salva i rendiconti Excel compensi/rimborsi.
- **Calcolo fiscale recupero crediti**: aggiunto il flag spese generali, calcolate come 10% configurabile sui compensi, con cassa forense applicata solo a compensi + spese generali e rimborsi sempre trattati come anticipazioni Art. 15.

### Sotto il cofano

- **Bonifica legacy spese**: rimosso l'import fattura basato su `expenses`, aggiunta la migration di dismissione della tabella legacy e ricondotti gli export al bucket `billing-exports`.

## [Non versionato] — 2026-05-08

### Non versionato

- **Verifica Supabase seriale**: aggiunto `npm run db:verify` per eseguire dry-run e advisor in sequenza, riducendo il rischio di blocchi temporanei `ECIRCUITBREAKER` del pooler.
- **Lockfile npm riallineato alla CI**: rigenerato `package-lock.json` con npm 10 per rendere `npm ci` compatibile con il workflow Quality su Node 22.
- **Pulizia branch post-pubblicazione**: chiarite le regole operative per eliminare branch locali e remoti già assorbiti dopo merge, pubblicazione o chiusura PR.
- **Ottimizzazione inbox Codex**: la inbox chiude automaticamente eventuali issue duplicate, compatta lo storico mostrato, limita le scansioni event-driven alle PR aperte/recenti e usa eventi PR in contesto trusted, mantenendo la scansione completa su schedule, dispatch manuale e commenti sulla inbox.
- **Hardening inbox Codex**: il workflow dei commenti Codex ora esegue lo script dalla default branch trusted e mantiene una scansione di riallineamento ogni 6 ore per ripulire i thread risolti o riaperti.
- **Codex feedback inbox event-driven**: sostituito il workflow settimanale dei commenti Codex con una scansione immediata su nuove review/commenti, issue GitHub unica `Codex feedback inbox`, controllo di tutte le PR e sollecito `@codex address that feedback` solo per thread actionable.
- **Stato commenti Codex fuori dal repo**: rimossi i file committati `.github/codex-pr-pending-comments.md` e `.github/codex-pr-scan-state.json`; la fonte di verità torna ai review thread GitHub e alla issue inbox.

## [0.8.0] — 2026-05-04

### Novità

- **Pratiche e attività Fase 5**: ricostruita la pratica come incrocio fra committente, cliente e controparte, con numero pratica numerico manuale o suggerito, voci fatturabili da Prezzi, quantità, udienze, allegati e stati da fatturare/fatturata.
- **Attività nel menu**: aggiunta la sezione `/attivita` per inserire e controllare rapidamente compensi/onorari e rimborsi spese senza entrare prima nel dettaglio pratica.
- **Spese ricondotte alla pratica**: rimossa la vecchia pagina autonoma `/spese`; i rimborsi spese si registrano come voci fatturabili della pratica.

### Sotto il cofano

- **Voci storiche fatturate**: rilassato il vincolo sulle attività fatturate per consentire l'inserimento manuale di voci già fatturate prima della generazione fatture in Pratix.
- **Definizione Attività ufficializzata**: aggiunta ADR 0014 e allineati glossario, memoria e piano evolutivo alla nuova label di prodotto.
- **Residui legacy ripuliti**: aggiornati README, robots e lockfile per rimuovere riferimenti operativi a `/spese` e alla cache npm Lovable.
- **Residui non bonificati censiti**: segnati in roadmap e piano i residui `expenses` da chiudere nella Fase 6.

## [0.7.0] — 2026-05-03

### Novità

- **Prezzi recupero crediti Fase 4**: aggiunta la sezione Prezzi per creare e modificare prezzi annuali per committente, con template comune 2025/2026, copia dall'anno precedente, voci compenso a prezzo unitario e rimborsi spese Art. 15 a importo libero.

### Sotto il cofano

- **Template Excel privati**: aggiunta una cartella locale ignorata per conservare i template 2026 senza portarli su GitHub.

## [0.6.0] — 2026-05-03

### Novità

- **Anagrafiche recupero crediti Fase 3**: aggiunte le sezioni Committenti e Controparti, il collegamento molti-a-molti fra clienti e committenti, le controparti composte con soggetti interni e i selettori riusabili per committente, cliente e controparte.

## [0.5.2] — 2026-05-03

### Sotto il cofano

- **Schema recupero crediti Fase 2**: aggiunta la migration compatibile per committenti, clienti multi-committente, controparti, numerazione pratica, prezzi annuali, attività fatturabili, allegati, fatturazione per periodo, rendiconti Excel e import guidato.

## [Non versionato] — 2026-05-03

### Non versionato

- **Roadmap test automatizzati**: aggiunta una voce generale per definire una strategia progressiva di unit, integration, smoke/e2e, fixture anonime e integrazione nei gate Quality/pre-push.
- **Prossimi passi a fine attività**: aggiornata la regola operativa per chiedere sempre, nelle conclusioni, i prossimi passi consigliati dopo ogni attività completata.

## [0.5.1] — 2026-05-03

### Correzioni

- **Rientro utenti autenticati**: la home reindirizza alla dashboard anche dopo una visita diretta a `pratix.vercel.app` con sessione già salvata.
- **Dashboard più focalizzata**: l'azione principale diventa `+ Pratica` a destra e i KPI scendono a sei rimuovendo il riepilogo bozze.

## [0.5.0] — 2026-05-03

### Novità

- **Scadenzario rimosso**: tolti pagina `/scadenze`, voce sidebar, card dashboard, tab pratica e tabella `case_deadlines`, mantenendo solo le scadenze fiscali proprie delle fatture.

### Sotto il cofano

- **Lint CI su file cancellati**: il workflow Quality esclude dal lint i file rimossi, così le PR di eliminazione moduli non falliscono su percorsi non più presenti.
- **Tipi Supabase allineati**: rigenerati i tipi dal database remoto dopo l'applicazione della migrazione che rimuove `case_deadlines`.

## [0.4.1] — 2026-05-03

### Sotto il cofano

- **Supabase Storage privato**: aggiunto il bucket `pratix-documents` con policy owner-scoped per documenti, fatture, allegati, asset profilo ed export.
- **Observability Vercel-first**: rafforzata la guida operativa su Web Analytics, Speed Insights, runtime logs strutturati e controlli Vercel senza introdurre Sentry.

## [0.4.0] — 2026-05-03

### Novità

- **Sitemap e robots pubblici**: aggiunti `sitemap.xml` e `robots.txt` per dichiarare le pagine pubbliche e tenere fuori dall'indicizzazione aree riservate e pagine operative di accesso.
- **Email Supabase in italiano**: personalizzati i template Auth di conferma account e recupero password con testi Pratix.

### Correzioni

- **Link recupero password non valido**: la pagina di reimpostazione ora mostra un messaggio chiaro e permette di richiedere un nuovo link invece di restare in verifica.

### Sotto il cofano

- **Ambiente Codex cloud allineato**: il workflow dei commenti Codex lavora solo sulle PR aperte, i gate locali ignorano file non tracciati usando `origin/main` come base quando una branch non ha upstream, e il vecchio lockfile Bun è stato rimosso.
- **Stato integrazioni documentato**: aggiornata la documentazione operativa su GitHub, Vercel e Supabase per distinguere ciò che è completato, ciò che resta solo da verificare nel tempo e le integrazioni lasciate fuori dal percorso gratuito.
- **Secret e backup fuori repo**: rafforzate regole e ignore list per tenere dump, archivi, chiavi private e secret runtime fuori da GitHub.
- **Indici foreign key Supabase**: aggiunti gli indici mancanti su `case_status_history.user_id` e `invoice_lines.user_id` per chiudere gli avvisi informativi del Performance Advisor senza rimuovere indici ancora privi di traffico storico.
- **Residui advisor Supabase**: documentate le decisioni operative su leaked password protection non free-tier e indici unused da rivalutare solo con traffico reale.
- **Artefatti Playwright locali**: esclusi dagli stage Git gli snapshot generati dai controlli browser manuali.

## [0.3.9] — 2026-05-02

### Sotto il cofano

- **Gate Prettier esplicito**: aggiunti controlli di formattazione sui soli file cambiati in pre-push e nel workflow Quality, con comando di fix mirato.

## [0.3.8] — 2026-05-02

### Sotto il cofano

- **Pre-push intelligente**: l'hook locale seleziona build, lint e audit in base al diff e riusa una cache per non ripetere controlli già validati sulla stessa fingerprint.
- **Verifica Vercel proporzionata**: documentato quando le modifiche solo documentali possono chiudersi senza attendere Vercel e quando invece serve una verifica production leggera.

## [0.3.7] — 2026-05-02

### Correzioni

- **Release con placeholder non versionati**: `npm run release` ignora le sezioni `Non versionato` vuote, evitando blocchi quando il changelog contiene solo intestazioni placeholder.

### Sotto il cofano

- **Gestione settimanale commenti Codex**: aggiunto un workflow GitHub Actions che analizza solo le nuove PR rispetto all'ultimo stato salvato e chiede a Codex di gestire eventuali thread non risolti.
- **Guardrail agenti rafforzati**: chiariti perimetro prodotto, gestione del worktree sporco, verifiche UI sostanziali e riepiloghi finali senza footer rituali.

## [0.3.6] — 2026-05-02

### Sotto il cofano

- **Quattro categorie di versioning**: formalizzato che ogni modifica rientra sempre in MAJOR, MINOR, PATCH oppure nessuna release; `npm run release` riconosce anche la categoria `Non versionato` senza produrre una nuova versione.

## [0.3.5] — 2026-05-02

### Sotto il cofano

- **Criteri SemVer più selettivi**: il comando di release distingue MAJOR, MINOR, PATCH e interventi non versionabili, bloccando il rilascio quando il changelog contiene sezioni non riconosciute o non destinate a una release.

## [0.3.4] — 2026-05-02

### Sotto il cofano

- **Release automatizzata**: aggiunto `npm run release` per trasformare automaticamente il blocco `[Non rilasciato]` in una nuova versione SemVer, aggiornando `CHANGELOG.md` e `src/lib/version.ts`.
- **Pubblicazione completa definita**: chiarito che "pubblicato" significa merge su `main`, deployment production Vercel verificato e chiusura del branch dedicato.

## [0.3.3] — 2026-05-02

### Sotto il cofano

- **Lint e formattazione puliti**: riallineato il repository alle regole Prettier/ESLint, esclusi dai controlli i file generati e tipizzati gli ultimi punti fatture che usavano `any`.

## [0.3.2] — 2026-05-02

### Correzioni

- **Registrazione compatibile con conferma email**: se Supabase richiede la conferma dell'indirizzo, la pagina Registrati mostra lo stato corretto invece di mandare subito in dashboard.

### Sotto il cofano

- **Analytics e performance Vercel**: aggiunti Web Analytics e Speed Insights ufficiali nel root React, attivabili dal dashboard Vercel.
- **CAPTCHA Supabase predisposto**: login, registrazione e recupero password inviano il token Cloudflare Turnstile quando `VITE_TURNSTILE_SITE_KEY` è configurata.
- **Cron Vercel giornaliero**: aggiunto `/api/cron/daily` con protezione `CRON_SECRET` e schedule giornaliera in `vercel.json`.
- **Checklist Auth Supabase free**: documentate registrazione aperta, conferma email, anonymous sign-ins disattivati, rate limit, Custom SMTP e template italiani.
- **Quality gate GitHub leggero**: aggiunto workflow Actions su PR e avvio manuale con build, lint sui sorgenti modificati e audit mirato.
- **Dependabot esteso alle Actions**: gli aggiornamenti GitHub Actions sono ora controllati settimanalmente e raggruppati per ridurre rumore.
- **Comandi Supabase operativi**: aggiunti script npm per advisors, dry-run delle migration e rigenerazione types senza automatizzare deploy DB.
- **Guide GitHub/Vercel/Supabase rafforzate**: documentato il flusso gratuito con preview Vercel, env separati, niente secondo Supabase e backup manuale.

## [0.3.1] — 2026-05-02

### Correzioni

- **Termini allineati al glossario**: la pagina Termini usa "professione" al posto dei riferimenti generici ad attività o studio professionale.
- **Separatori title standardizzati**: i titoli pagina e i meta tag usano `·` al posto del trattino lungo (`Dashboard · Pratix`), lasciando `Pratix · Tutto torna.` solo alla home pubblica.
- **Recupero password più chiaro**: se la nuova password coincide con quella precedente, la pagina ora mostra un messaggio specifico invece di chiedere un nuovo link di recupero.

### Sotto il cofano

- **Migrazione tecnica completata**: Pratix è operativo su GitHub, Vercel e Supabase di proprietà; Lovable resta solo parcheggiato come archivio temporaneo non operativo.
- **Env tracciato riallineato**: `.env` punta al nuovo progetto Supabase di proprietà invece del vecchio ref storico.
- **Migration FK resa idempotente**: la migration di ripristino foreign key salta i vincoli già presenti, così Supabase Preview può ricostruire il database da zero.
- **Audit riferimenti Lovable aggiunto**: censiti i riferimenti storici rimasti e definito il gate operativo per distinguere runtime pulito da documentazione storica.
- **Documentazione operativa aggiornata**: guide e regole di lavoro descrivono ora GitHub, Vercel e Supabase come filiera corrente.
- **Riferimenti runtime Lovable rimossi**: i messaggi di errore Supabase indicano ora Vercel o l'ambiente locale, e la configurazione Bun residua della vecchia sandbox è stata eliminata.
- **Policy RLS ottimizzate**: aggiornate le policy Supabase per valutare `auth.uid()` una sola volta per statement e rimuovere gli avvisi performance `auth_rls_initplan`.
- **Leaked Password Protection valutata**: documentato che l'advisor Supabase resta non bloccante perché la protezione richiede un piano Pro o superiore.
- **Permessi funzioni Supabase ristretti**: revocata l'esecuzione RPC pubblica delle funzioni usate solo dai trigger del database.
- **Piano di uscita da Lovable**: aggiunti ADR-0009 e `docs/guides/uscita-lovable.md` per migrare Pratix fuori da Lovable al 100%, con backend Supabase di proprietà, pubblicazione tramite Vercel, checklist di cutover e bonifica finale di tutti i riferimenti Lovable nel working tree.
- **Inventario migrazione Lovable**: integrato nel piano l'esito dell'inventario backend: un solo utente, una sola riga `profiles`, nessun dato in clienti/pratiche/fatture, nessuno storage bucket, nessuna Edge Function e migrations allineate.
- **Baseline Supabase autosufficiente**: aggiunto a `supabase/schema.sql` il trigger `on_auth_user_created` su `auth.users` e creato `scripts/recreate-supabase-user.mjs` per ricreare l'utente nel nuovo Supabase preservando l'UUID, usando solo variabili d'ambiente.
- **Inventario sanitizzato per GitHub**: aggiunto `docs/migration/lovable-inventory.md` con le risposte tecniche Lovable ripulite da dati personali e aggiornato `.gitignore` per bloccare export locali con PII o dump.
- **Promemoria password migrazione**: aggiunto al piano il cambio obbligatorio della password temporanea dall'area Account prima della chiusura definitiva di Lovable.
- **Password migrazione sostituita**: verificato il login locale sul nuovo Supabase e sostituita la password temporanea dall'area Account.
- **Email Auth Supabase tracciate**: segnato nel piano che le email di recupero password possono arrivare da Supabase Auth durante la migrazione e che mittente/template brandizzati sono un'attività post-cutover.
- **Runtime Vercel preparato**: sostituita la configurazione Vite proprietaria Lovable con una configurazione esplicita TanStack Start + Nitro per Vercel, rimosso `wrangler.jsonc` e aggiornate le dipendenze.
- **Build Vercel alleggerita**: caricato il generatore PDF solo al download della fattura e filtrati i warning innocui provenienti da dipendenze terze durante la build.
- **Foreign key Supabase ripristinate**: aggiunta una migration per riallineare il nuovo backend Supabase alle relazioni delle migrations storiche, necessarie alle join PostgREST usate da pratiche, scadenze, spese e fatture.
- **Supabase locale riallineato**: aggiornato `supabase/config.toml` al nuovo progetto Supabase di proprietà usato da Vercel.
- **Schema baseline su GitHub**: aggiunto `supabase/schema.sql`, fotografia leggibile dello stato del database (tabelle, enum, trigger, indici, policy RLS) alla versione 0.3.0. Serve come riferimento per chi legge il repo senza accesso a Lovable Cloud.
- **Modello dati documentato**: nuovo `docs/data-model.md` con descrizione narrativa di tabelle, relazioni e RLS, e `docs/guides/migrations.md` con il flusso operativo per applicare migrations via Lovable Cloud.
- **Templates issue/PR e Dependabot**: aggiunti `.github/ISSUE_TEMPLATE/` (bug, idea), `PULL_REQUEST_TEMPLATE.md`, `dependabot.yml` (npm settimanale, minor/patch raggruppati). Niente GitHub Actions per il momento.
- **`AGENTS.md` riscritto**: stack reale (TanStack Start + Lovable Cloud) descritto con link a `docs/data-model.md`, `BRAND.md`, `docs/guides/architettura.md`. Aggiunte sezioni "File generati intoccabili", "Sync GitHub ↔ Lovable", "Glossario di prodotto", "Documentazione, memoria, glossario", "Versioning e rilascio". Esplicitato che lockfile autoritativo è `package-lock.json` (collaboratori usano npm, sandbox Lovable usa bun).
- **`AGENTS.md` esteso**: aggiunte sezioni "Errori comuni da evitare" (router, colori, logo, tema, supabase client, RLS), "Server functions vs route API" (RPC tipato vs endpoint HTTP raw, helper `*.server.ts`), "Gestione segreti" (mai in `.env`, sempre via tool secrets), e mappa rapida "tipo di modifica → file da toccare" come tabella di riferimento.
- **Gate versioning post-fase aggiunto**: istruzioni agenti, guida di rilascio e mirror memoria richiedono ora di chiudere o dichiarare esplicitamente il rilascio quando una fase, migrazione o cutover viene completata con voci già presenti nel changelog.

## [0.3.0] — 2026-04-29

### Novità

- **Area Account separata**: il tuo profilo personale, l'email di accesso, il cambio password, il tema e le notifiche vivono ora in `/account`, raggiungibile dal menu utente in alto a destra. `/impostazioni` resta dedicata ai tuoi dati professionali (anagrafica, fiscale, IBAN, numerazione fatture).
- **Cambio password in autonomia**: nuova sezione "Accesso e sicurezza" in Account. Inserisci la password attuale e la nuova, senza dover passare dal flusso di recupero email.
- **Menu utente in topbar**: nuovo avatar circolare accanto alla campanella, con scorciatoie ad Account, Cambia password, Impostazioni professione e Esci.

### Correzioni

- **Glossario**: dismessa la parola **"attività"** come label di prodotto perché ambigua (in italiano significa sia "impresa" sia "azione/task", e in Pratix indica già le voci di lavoro fatturabili). Sostituita ovunque con **"professione"** / "i tuoi dati professionali": tab Impostazioni → Professione, header "La mia professione", onboarding, dashboard, registrazione, menu utente. ADR-0005 aggiornato di conseguenza.

## [0.2.1] — 2026-04-29

### Novità

- **Più visibilità al brand nella landing**: aggiunto il monogramma "Px" grande sopra al claim "Tutto torna." e logo ingrandito nella barra in alto, per riconoscimento immediato prima del login.
- **Logo più grande nelle aree autenticate**: barra laterale e barra in alto con il monogramma più presente, senza occupare spazio in più ai contenuti.

### Correzioni

- **Glossario**: rimosso il termine "assistiti" dalla pagina Clienti (sostituito con "clienti").
- **Colore della chrome browser**: la barra superiore di iOS/Android ora segue il tema (inchiostro su scuro, panna su chiaro) invece di mostrare il vecchio navy.

### Sotto il cofano

- Asset di pubblicazione (favicon, icona PWA, immagine social) rigenerati con la palette inchiostro + terracotta.
- Categorie del changelog ridisegnate (`Novità` / `Correzioni` / `Sotto il cofano`) per separare ciò che cambia nell'esperienza da ciò che è interno. La pagina `/novita` mette in evidenza le Novità, mantiene compatte le Correzioni e raccoglie le voci tecniche in un blocco espandibile.

## [0.2.0] — 2026-04-29

### Aggiunto

- **Pagina Novità** in-app (`/novita`, autenticata): mostra il changelog con voci raggruppate per versione, parsato a build time da `CHANGELOG.md`. Solo le versioni rilasciate sono visibili agli utenti.
- **Campanella in topbar**: icona discreta accanto al nome dell'attività, con puntino terracotta quando esiste una versione più recente di quella già vista. Aprire la pagina Novità segna la versione corrente come letta.
- **Footer Impostazioni** con versione corrente, data di build e link a "Cosa è cambiato".
- **`src/lib/version.ts`**: single source of truth per `APP_VERSION` e `BUILD_DATE`.
- **ADR-0008**: nuova decisione "Versioning e changelog" che formalizza SemVer adattato al contesto SaaS, regole di bump, e procedura di rilascio.
- **`docs/guides/versioning-e-release.md`**: guida operativa per rilasciare una nuova versione (3 passaggi meccanici + checklist di verifica).
- Documentazione strutturata: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`.
- Cartella `docs/` con guide tematiche (`architettura`, `database`, `fatturazione`, `tema-e-design`, `tono-di-voce`, `deploy`), memoria di progetto esplicitata in markdown, decision log (ADR) e glossario di dominio.
- **Recupero password**: pagina `/recupera-password` (richiesta link via email) e pagina `/reimposta-password` (impostazione nuova password dopo il link), con messaggi generici per evitare user enumeration.
- Link "Password dimenticata?" nella pagina di login.
- **Pagine legali**: `/privacy` e `/termini` con contenuti placeholder professionali in attesa di revisione legale.
- Footer della landing con link a Privacy e Termini.
- **Open Graph + Twitter Card**: `og:image` 1216×640 brandizzata, `og:site_name`, `twitter:title`, `twitter:description`, `twitter:image`. Separatore titoli aggiornato da em-dash a middle dot (`Pratix · Tutto torna.`) per coerenza editoriale.
- **ADR-0007**: decisione "Palette inchiostro + terracotta" con motivazione di differenziazione dal territorio fintech bancario (Fineco, banche commerciali).
- **Token logo adattivi** in `src/styles.css`: `--logo-tile`, `--logo-glyph`, `--logo-border`, `--logo-border-opacity`, `--logo-wordmark`. Permettono al logo di cambiare automaticamente tile e glifo fra light e dark senza sacrificare l'identità.
- **Asset di pubblicazione**: `public/app-icon-512.png` (icona PNG quadrata 512×512 con tile inchiostro e monogramma "Px") da caricare come Project icon nelle Project Settings di Lovable. Social preview riutilizza `public/og-image.jpg`.
- **Prima pubblicazione su Lovable**: il prodotto è online su `https://pratix-legal.lovable.app`.

### Modificato

- **Database**: aggiunto campo `last_seen_changelog_version` alla tabella `profiles` per tracciare l'ultima versione delle Novità vista da ogni utente.
- **Palette brand**: il primario passa da navy `oklch(0.30 0.07 255)` a inchiostro profondo `oklch(0.22 0.04 260)`; l'accento passa da oro brunito `oklch(0.68 0.11 75)` a terracotta `oklch(0.62 0.15 35)`. Lo sfondo dark passa a un grigio caldo (hue 60) per armonizzare con la terracotta. Vibe editoriale legale italiano, lontano dal territorio fintech. I nomi dei token (`--brand-navy`, `--brand-gold`) sono mantenuti come alias storici per non rompere il codice esistente.
- **Logo dark adattivo**: il tone `navy` di `<Logo>` ora cambia tile e glifo fra light e dark per garantire leggibilità sul fondo scuro. Tone `inverse` e `mono` invariati.
- **og:image** rigenerata con la nuova palette (inchiostro+terracotta su panna).
- Memoria di progetto sincronizzata con i nuovi mirror in `docs/memory/`.

### Sicurezza

- **Fix info leak in registrazione**: il messaggio di errore è ora generico ("Registrazione non riuscita. Riprova o accedi se hai già un account.") al posto del messaggio Supabase grezzo, prevenendo l'enumerazione degli utenti registrati.

---

## [0.1.0] — 2026-04-29

Prima base condivisa del prodotto: identità di marca, tema, glossario, fatturazione e gestione dati di base.

### Aggiunto

- **Identità di marca**: nome **Pratix**, tagline ufficiale **"Tutto torna."**, palette navy + oro brunito + panna, tipografia Inter Tight + Inter + JetBrains Mono.
- **Logo unificato** `<Logo>` con direzione default `px` e favicon SVG, mai SVG inline.
- **Token semantici** in `src/styles.css` (mai hex inline) e token brand fissi cross-tema (`--color-brand-navy/cream/gold`).
- **Tema chiaro/scuro**: auto (segue sistema) + override manuale, provider in `src/lib/theme-context.tsx`, `<ThemeToggle>` in sidebar/landing/impostazioni, no-flash script in `__root.tsx`.
- **Onboarding wizard** in 3 step (anagrafica / fiscale / pagamenti).
- **Pratiche, Clienti, Fatture** con CRUD di base.
- **Generazione fattura PDF** (`src/lib/invoice-pdf.ts`).
- **Generazione XML FatturaPA** TD06/Parcella (`src/lib/invoice-xml.ts`).
- **Autenticazione** email/password con RLS sulle tabelle utente.
- **`AGENTS.md`** con regole operative per agenti e collaboratori.
- **`BRAND.md`** con guidelines di marca complete.
- **`ROADMAP.md`** con stato per area (brand, tema, landing, prodotto, account, SEO, processo).

### Modificato

- **Dark mode** ammorbidita: da navy intenso a grigio caldo neutro `oklch(0.18 0.012 250)` con croma molto bassa, più riposante per gli occhi.
- **Glossario freelance**: rimossa la parola **"studio"** da tutta la UI (target è avvocato singolo, non studio associato). Sostituiti tab, label, descrizioni meta, copy onboarding e fallback fatture con "attività" / "tua attività professionale" / "Avvocato".
- **Tagline**: scelta finale **"Tutto torna."** dopo iterazioni; documentato il triplo significato (contabile, narrativo, ordine) in `BRAND.md`.

### Sicurezza

- RLS abilitato su tutte le tabelle utente, policy per `user_id`.
- Linter Supabase pulito, scan di sicurezza senza issue critici.

[Non rilasciato]: #non-rilasciato
[1.4.0]: #140--2026-05-16
[1.3.4]: #134--2026-05-16
[1.3.3]: #133--2026-05-16
[1.3.2]: #132--2026-05-16
[1.3.1]: #131--2026-05-16
[1.3.0]: #130--2026-05-16
[1.2.19]: #1219--2026-05-16
[1.2.18]: #1218--2026-05-16
[1.2.17]: #1217--2026-05-16
[1.2.16]: #1216--2026-05-16
[1.2.15]: #1215--2026-05-16
[1.2.14]: #1214--2026-05-16
[1.2.13]: #1213--2026-05-16
[1.2.12]: #1212--2026-05-16
[1.2.11]: #1211--2026-05-16
[1.2.10]: #1210--2026-05-16
[1.2.9]: #129--2026-05-16
[1.2.8]: #128--2026-05-16
[1.2.7]: #127--2026-05-16
[1.2.6]: #126--2026-05-16
[1.2.5]: #125--2026-05-16
[1.2.4]: #124--2026-05-16
[1.2.3]: #123--2026-05-16
[1.2.2]: #122--2026-05-16
[1.2.1]: #121--2026-05-16
[1.2.0]: #120--2026-05-16
[1.1.5]: #115--2026-05-16
[1.1.4]: #114--2026-05-16
[1.1.3]: #113--2026-05-16
[1.1.2]: #112--2026-05-16
[1.1.1]: #111--2026-05-16
[1.1.0]: #110--2026-05-16
[1.0.2]: #102--2026-05-15
[1.0.1]: #101--2026-05-15
[1.0.0]: #100--2026-05-09
[0.20.1]: #0201--2026-05-09
[0.20.0]: #0200--2026-05-09
[0.19.0]: #0190--2026-05-09
[0.18.0]: #0180--2026-05-09
[0.17.0]: #0170--2026-05-09
[0.16.0]: #0160--2026-05-09
[0.15.0]: #0150--2026-05-09
[0.14.0]: #0140--2026-05-09
[0.13.3]: #0133--2026-05-09
[0.13.2]: #0132--2026-05-09
[0.13.1]: #0131--2026-05-09
[0.13.0]: #0130--2026-05-09
[0.12.9]: #0129--2026-05-09
[0.12.8]: #0128--2026-05-09
[0.12.7]: #0127--2026-05-09
[0.12.6]: #0126--2026-05-09
[0.12.5]: #0125--2026-05-09
[0.12.4]: #0124--2026-05-08
[0.12.3]: #0123--2026-05-08
[0.12.2]: #0122--2026-05-08
[0.12.1]: #0121--2026-05-08
[0.12.0]: #0120--2026-05-08
[0.11.0]: #0110--2026-05-08
[0.10.0]: #0100--2026-05-08
[0.9.0]: #090--2026-05-08
[0.8.0]: #080--2026-05-04
[0.7.0]: #070--2026-05-03
[0.6.0]: #060--2026-05-03
[0.5.2]: #052--2026-05-03
[0.5.1]: #051--2026-05-03
[0.5.0]: #050--2026-05-03
[0.4.1]: #041--2026-05-03
[0.4.0]: #040--2026-05-03
[0.3.9]: #039--2026-05-02
[0.3.8]: #038--2026-05-02
[0.3.7]: #037--2026-05-02
[0.3.6]: #036--2026-05-02
[0.3.5]: #035--2026-05-02
[0.3.4]: #034--2026-05-02
[0.3.3]: #033--2026-05-02
[0.3.2]: #032--2026-05-02
[0.3.1]: #031--2026-05-02
[0.3.0]: #030--2026-04-29
[0.2.1]: #021--2026-04-29
[0.2.0]: #020--2026-04-29
[0.1.0]: #010--2026-04-29
