# Piano — Pratix 1.0 readiness

- **Stato**: completato; release `1.0.0` pubblicata su `main` e verificata in produzione
- **Data**: 2026-05-09
- **Ambito**: stabilizzazione, verifica produzione e decisione di apertura controllata verso Pratix 1.0
- **Tipo modifica attesa**: non versionato finché resta piano/checklist; release MAJOR solo quando viene promosso `1.0.0`

## Obiettivo

Portare Pratix da roadmap prodotto sostanzialmente chiusa a release **1.0.0**
senza aprire una nuova fase funzionale ampia.

La 1.0 deve certificare che il perimetro attuale è stabile, verificato e
presentabile per l'uso reale di un avvocato freelance che gestisce attività di
recupero crediti. Non deve diventare il contenitore per nuove macro-feature.

## Perimetro 1.0

La 1.0 include il prodotto già costruito e documentato:

1. landing pubblica, auth e onboarding;
2. Dashboard, Pratiche, Committenti, Clienti, Controparti, Attività, Prezzi e
   Fatture;
3. workflow recupero crediti nel cruscotto Pratica;
4. attività fatturabili con compensi/onorari e rimborsi spese;
5. fatturazione per committente e periodo;
6. PDF fattura, XML FatturaPA, ZIP fatture e rendiconti Excel;
7. Creazione guidata manuale;
8. dossier Pratica Excel e PDF;
9. export dati personali e cancellazione account;
10. qualità operativa già consolidata: build, lint, test, coverage, smoke
    accessibilità, RLS, Storage privato, Vercel e Supabase.

## Fuori perimetro 1.0

Restano esplicitamente post-1.0, salvo nuova decisione:

1. time tracking per pratica;
2. area cliente esterna;
3. invio diretto al Sistema di Interscambio;
4. dominio proprietario;
5. upgrade Supabase Pro solo per Leaked Password Protection;
6. nuovi provider, nuove integrazioni o nuove superfici multi-utente;
7. pricing a pagamento operativo con checkout, salvo decisione commerciale
   esplicita prima dell'apertura.

Queste voci non bloccano la 1.0 perché non fanno parte del valore centrale già
chiuso: gestione operativa e fatturabile del recupero crediti per il singolo
professionista.

## Criteri di via libera

La 1.0 è pronta solo se tutti questi punti sono veri.

### Prodotto

1. Il flusso principale funziona in produzione:
   registrazione/login, onboarding, creazione Committente, Cliente,
   Controparte, Pratica, Attività e Fattura.
2. Il flusso recupero crediti è comprensibile senza istruzioni esterne:
   cruscotto Pratica, stato operativo, priorità, prossima azione e qualità dati.
3. Gli export chiave sono scaricabili e apribili:
   PDF fattura, XML FatturaPA, ZIP fatture, rendiconti Excel, dossier Pratica
   Excel/PDF, export dati personali.
4. La Creazione guidata manuale è utilizzabile per trascrivere una pratica da
   archivio.
5. I testi restano coerenti con tono, glossario e target freelance.
6. La landing non promette funzionalità post-1.0 come invio SDI, area cliente
   esterna o suite contabile completa.

### Sicurezza e dati

1. RLS attiva e owner-scoped sulle tabelle user-owned.
2. Storage privato verificato per fatture, allegati, export e asset profilo.
3. Nessun segreto, dato personale reale o export locale nel repo.
4. Auth con messaggi generici anti user enumeration.
5. Export dati e cancellazione account verificati con fixture anonime.
6. Cron protetto da `CRON_SECRET` e senza leak di dettagli sensibili nei log.

### Qualità tecnica

1. `npm run ci:local` passa.
2. `npm run format:changed:check` passa sul diff della fase.
3. `npm run smoke:a11y` passa sulle route pubbliche e autenticate disponibili.
4. `npm run db:push:dry-run` non mostra drift inatteso.
5. `npm run db:advisors:security` non segnala problemi bloccanti.
6. `npm audit --audit-level=moderate` resta pulito.
7. Produzione Vercel `https://pratix.vercel.app` risponde sulle route pubbliche
   e sui flussi autenticati di smoke.

### Commerciale e posizionamento

1. La fase gratuita o beta privata è dichiarata in modo coerente nella landing.
2. Se non viene attivato un piano a pagamento, la 1.0 resta comunque
   pubblicabile come release stabile gratuita/privata.
3. Se si decide un piano a pagamento prima della 1.0, serve un piano separato
   per checkout, fatturazione, privacy e supporto. Non va infilato nella
   readiness tecnica.

## Sequenza operativa

### Fase 0 — Freeze del perimetro

1. Confermare che le voci `💤` in roadmap restano post-1.0.
2. Controllare che `CHANGELOG.md` non contenga `Novità`, `Correzioni` o
   `Sotto il cofano` non ancora rilasciati.
3. Se il blocco `[Non rilasciato]` contiene solo `Non versionato`, non eseguire
   release intermedia.

Esito 2026-05-09: completata. Restano post-1.0 time tracking per pratica, area
cliente esterna, invio diretto al Sistema di Interscambio, Leaked Password
Protection Supabase e dominio proprietario. Il blocco `[Non rilasciato]`
contiene solo voci `Non versionato`, quindi non serve una release intermedia
prima della readiness locale.

### Fase 1 — Readiness locale

Comandi:

```sh
git status --short
npm run format:changed:check
npm run ci:local
npm run smoke:a11y
npm run db:push:dry-run
npm run db:advisors:security
npm audit --audit-level=moderate
```

Esito atteso: nessun errore bloccante. I warning non bloccanti vanno riportati
nel riepilogo della fase con impatto e prossimo passo.

Esito 2026-05-09: completata.

Controlli completati:

1. `git status --short`: branch `codex/pratix-1-0-readiness`, solo modifiche
   documentali attese.
2. `npm run format:changed:check`: ok.
3. `npx prettier --check docs/plans/pratix-1-0-readiness.md`: ok.
4. `git diff --check`: ok.
5. `npm run ci:local`: ok; build, 124 test su 45 file, lint e audit moderato
   completati senza errori.
6. `npm run smoke:a11y`: ok; 36 combinazioni auditate su desktop, tablet,
   mobile, tema chiaro e tema scuro, con `issueCount: 0`. Lo smoke è stato
   eseguito senza credenziali `PRATIX_SMOKE_EMAIL`/`PRATIX_SMOKE_PASSWORD`,
   quindi non ha coperto route autenticate.
7. `npm run db:advisors:security`: ok con warning non bloccante
   `auth_leaked_password_protection`, già parcheggiato perché richiede piano
   Supabase superiore.
8. `npm audit --audit-level=moderate`: ok, 0 vulnerabilità.

Controllo Supabase:

1. Primo tentativo `npm run db:push:dry-run`: non completato perché
   `SUPABASE_DB_PASSWORD` non era presente nell'ambiente locale. Il CLI
   Supabase ha fallito l'autenticazione del ruolo temporaneo
   `cli_login_postgres` e il pooler ha attivato temporaneamente il circuit
   breaker dopo più tentativi falliti.
2. Secondo tentativo con `SUPABASE_DB_PASSWORD` fornita solo a runtime:
   completato. Esito: `Remote database is up to date`.

### Fase 2 — Smoke produzione

Usare account e fixture anonime. Verificare:

1. home pubblica, login, registrazione, recupero password, privacy e termini;
2. login con account test;
3. onboarding già completato e profilo/account;
4. creazione o riuso fixture recupero crediti;
5. generazione fattura e download PDF/XML;
6. download rendiconti Excel;
7. download dossier Pratica Excel/PDF;
8. import manuale o Excel con una riga anonima;
9. export dati personali;
10. controllo rapido log Vercel per errori runtime collegati allo smoke.

Browser Use è adatto per i controlli ripetibili. Computer Use/Safari va usato
solo quando serve verificare una resa reale non coperta dagli script.

Esito 2026-05-09: completata.

Controlli pubblici:

1. Probe HTTP su `/`, `/login`, `/register`, `/recupera-password`, `/privacy` e
   `/termini`: tutte le route hanno risposto `200`.
2. `PRATIX_SMOKE_BASE_URL="https://pratix.vercel.app" node scripts/smoke-a11y.mjs --public-only`:
   ok; 36 combinazioni auditate su desktop, tablet, mobile, tema chiaro e tema
   scuro, con `issueCount: 0`.

Controlli autenticati:

1. Login produzione completato con account test
   `codex.pratix.test.20260509@gmail.com`.
2. Smoke autenticato produzione completato con
   `PRATIX_SMOKE_BASE_URL="https://pratix.vercel.app"` e password letta dal
   Portachiavi macOS: 108 combinazioni auditate, `authenticated: true`,
   `issueCount: 0`.
3. Fixture anonima recupero crediti confermata via Supabase autenticato e RLS:
   pratica `5093212`, due Attività fatturate, un allegato attività con storage
   path presente e fattura `TST1/2026`.
4. Dettaglio Pratica in produzione verificato: numero pratica, titolo,
   Attività e allegato visibili.
5. Download dossier Pratica verificati: Excel `dossier-pratica-5093212.xlsx` e
   PDF `dossier-pratica-5093212.pdf`.
6. Dettaglio Fattura in produzione verificato: fattura `TST1/2026`, totale
   `114,00`.
7. Download fattura e rendiconti verificati: PDF, XML SdI, rendiconto compensi
   Excel e rendiconto rimborsi spese Excel.
8. Creazione guidata verificata in produzione: route accessibile e wizard
   manuale presenti. Non è stata creata una nuova riga perché la fixture anonima
   già esistente copre il flusso con allegato.
9. Export dati personali verificato in produzione: download JSON e archivio
   CSV/ZIP completati. La cancellazione account non è stata eseguita perché è
   distruttiva; la presenza del comando è stata verificata nella tab Dati.

Controlli Vercel:

1. Progetto Vercel `pratix` verificato con produzione `READY` su deployment
   `dpl_C4KxWbWD6PtgrGv7AWgxJjumzpAR`, runtime Node `24.x`.
2. Build log ultimo deployment controllato: build completata, unico warning
   noto su range `engines.node >=24 <27`.
3. Runtime log produzione controllati con Vercel CLI:
   `vercel logs --environment production --level error --since 30m` e
   `vercel logs --environment production --status-code 500 --since 30m` non
   hanno trovato log.
4. Primo tentativo di smoke pubblico/autenticato in parallelo aveva generato
   timeout WebKit su route pubbliche diverse; ripetendo i controlli in sequenza
   tutte le verifiche sono passate. L'evento è trattato come limite operativo
   dello smoke parallelo, non come bug prodotto.

### Fase 3 — Correzioni mirate

Se emergono bug:

1. correggere solo i bug che bloccano uso reale, sicurezza, export, import,
   fatturazione o comprensione del flusso;
2. evitare nuove funzionalità;
3. aggiornare `CHANGELOG.md` nella categoria corretta;
4. rieseguire solo i gate proporzionati al diff, poi il gate finale.

Esito 2026-05-09: completata dopo controllo `Codex feedback inbox`.

Thread P2 assorbiti nel diff 1.0:

1. Import Excel: questi thread sono storici e superati da ADR 0016, che rimuove
   l'import Excel strutturato.
2. Creazione guidata: resta il flusso manuale con staging e conferma.
3. Dossier Pratica: i download dal cruscotto sono disabilitati anche durante il
   refresh dei dati necessari al dossier.
4. Workflow recupero crediti: il calcolo delle Fatture insolute confronta la
   sola data di calendario, evitando anticipi legati a timestamp o fusi orari.

### Fase 4 — Release 1.0.0

Quando tutti i criteri sono soddisfatti:

```sh
npm run release -- --bump major
npm run format:changed:check
npm run ci:local
npm run smoke:a11y
npm run db:push:dry-run
```

Poi:

1. verificare il diff generato da `npm run release`;
2. creare branch dedicato `codex/pratix-1-0`;
3. committare con Conventional Commit, ad esempio `chore: release Pratix 1.0.0`;
4. aprire PR con template;
5. controllare issue GitHub `Codex feedback inbox`;
6. attendere check GitHub;
7. merge su `main`;
8. verificare deployment production Vercel `READY`;
9. ripetere smoke essenziale in produzione;
10. eliminare branch remoto e locale se assorbito.

Esito 2026-05-09, pre-push: release `1.0.0` preparata.

1. `CHANGELOG.md` separato fra voce versionata `Pratix 1.0` e blocco
   `Non versionato` per la readiness.
2. `npm run release:dry-run -- --bump major`: ok; versione prevista `1.0.0`,
   gate React Doctor indicato.
3. `npm run release -- --bump major`: ok; React Doctor eseguito in modalità
   major e completato con score `95 / 100`, senza errori bloccanti. Restano
   warning non bloccanti già tracciabili come debito tecnico ordinario.
4. `src/lib/version.ts` aggiornato a `APP_VERSION = "1.0.0"` e
   `BUILD_DATE = "2026-05-09"`.
5. `npm run format:changed:check`: ok.
6. `npx prettier --check docs/plans/pratix-1-0-readiness.md`: ok.
7. `git diff --check`: ok.
8. `npm run ci:local`: ok; build, 124 test su 45 file, lint e audit moderato
   completati senza errori.
9. `npm run smoke:a11y`: ok; 36 combinazioni auditate su desktop, tablet,
   mobile, tema chiaro e tema scuro, con `issueCount: 0`.
10. `npm run db:push:dry-run`: ok dopo aver fornito
    `SUPABASE_DB_PASSWORD` solo a runtime; esito `Remote database is up to date`.
11. `Codex feedback inbox`: verificata issue GitHub #34; i quattro thread P2
    actionable sono stati corretti prima di commit/PR.
12. Dopo le correzioni P2, `npm run format:changed:check`: ok.
13. Dopo le correzioni P2, `npm run ci:local`: ok; build, 125 test su 45 file,
    lint e audit moderato completati senza errori.
14. Dopo le correzioni P2, `npm run smoke:a11y`: ok; 36 combinazioni auditate
    su desktop, tablet, mobile, tema chiaro e tema scuro, con `issueCount: 0`.
15. Retry post-correzioni di `npm run db:push:dry-run`: primo tentativo non
    completato perché gli appunti non contenevano più la password DB corretta.
    Retry successivo con password ripulita da newline/carriage return:
    completato, esito `Remote database is up to date`.

Esito 2026-05-09, post-merge: release `1.0.0` pubblicata e verificata.

1. PR #71 mergeata su `main` con merge commit
   `a5691e626a689de5e4f248ce63f227b9c56e6c97`.
2. Branch remoto `codex/pratix-1-0` eliminato da GitHub e branch locale
   eliminato dopo verifica di assorbimento.
3. Checkout locale allineato su `main` a `origin/main`.
4. Deployment production Vercel
   `https://pratix-751fctnay-matteos-projects-9226d217.vercel.app` verificato
   `READY`.
5. Route pubbliche su `https://pratix.vercel.app`: `/`, `/login`,
   `/register`, `/recupera-password`, `/privacy` e `/termini` hanno risposto
   `200`.
6. Runtime log Vercel production controllati per errori e status `500`: nessun
   log trovato.
7. Smoke Playwright a11y production completo non conclusivo perché WebKit è
   rimasto appeso; i processi `smoke-a11y`/Playwright/WebKit sono stati
   terminati e verificati assenti.
8. Smoke autenticato mirato post-merge completato con account test: login,
   arrivo su `/dashboard` e accesso a `/pratiche`.

## Via libera / stop

### Via libera

Si procede alla release 1.0.0 quando:

1. i gate locali sono verdi;
2. lo smoke produzione è completato;
3. non ci sono bug bloccanti su fatturazione, import, export, auth, RLS o
   cancellazione account;
4. il posizionamento pubblico non promette fuori perimetro;
5. il changelog è coerente con il bump MAJOR.

### Stop

Non si procede se emerge almeno uno di questi punti:

1. errore di build, lint, test o audit moderato non spiegato;
2. drift DB inatteso o policy RLS dubbia;
3. PDF/XML/rendiconti non scaricabili o incoerenti;
4. import che crea duplicati non governati o perde righe;
5. cancellazione account o export dati incompleti;
6. errori runtime in produzione durante lo smoke;
7. decisione commerciale non coerente con i testi pubblici.

## Rollback

La fase readiness è documentale e non richiede rollback tecnico.

La release 1.0.0, una volta mergeata, può essere gestita così:

1. se il problema è documentale o microcopy, patch `1.0.1`;
2. se il problema è runtime ma non dati, revert o hotfix su branch dedicato;
3. se il problema coinvolge schema o dati, fermare nuove modifiche, esportare
   evidenze anonime, valutare migration correttiva e pubblicare patch solo dopo
   dry-run Supabase.

## Esito atteso

Alla fine della fase Pratix deve avere:

1. un perimetro 1.0 congelato;
2. checklist di readiness completata;
3. eventuali bug bloccanti corretti;
4. changelog pronto;
5. release `1.0.0` pubblicata su `main`;
6. deployment production Vercel verificato;
7. branch dedicato chiuso.
