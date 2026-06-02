# Guida — Deploy e pubblicazione

## Modello

Pratix viene pubblicato su **Vercel** dal repository GitHub.

- **Codice**: GitHub (`https://github.com/max23468/Pratix.git`)
- **Hosting**: Vercel
- **Produzione**: `https://pratix.vercel.app`
- **Backend**: Supabase di proprietà del progetto

## Deploy

1. Lavora su branch dedicato.
2. Prepara il giro con `npm run publish:prepare`.
3. Esegui le verifiche pertinenti in locale.
4. Push su GitHub.
5. Apri una PR verso `main`: GitHub esegue il workflow `Quality`.
6. Vercel crea un deployment di preview dal branch.
7. Quando Quality e preview sono verificati, fai merge su `main`.
8. Vercel pubblica la produzione dal branch `main`.

Il workflow GitHub è volutamente leggero: `npm ci`, `npm run build`, lint solo
sui file sorgente modificati e `npm audit --audit-level=moderate` solo quando
cambiano `package.json` o `package-lock.json`. L'avvio manuale esegue sempre
anche l'audit.

Il repo resta privato e nel percorso gratuito: non basare il processo su branch
protection a pagamento. La protezione reale è la disciplina di PR + Quality +
preview Vercel.

### Preparazione rapida

Usa `npm run publish:prepare` prima del push o quando devi capire quanto lavoro
resta prima della pubblicazione. Il comando non modifica file: legge lo stato Git,
controlla se nel worktree mancano le dipendenze, classifica il diff, guarda il
blocco `CHANGELOG.md` `[Non rilasciato]` e propone la sequenza rapida.

Se lavori in un worktree pulito appena creato, `node_modules` può mancare: in
quel caso esegui `npm ci` una volta nella cartella del worktree. La cache npm
resta condivisa a livello macchina, quindi i run successivi sono normalmente più
rapidi.

Quando vuoi far partire anche il gate locale proporzionato al diff:

```sh
npm run publish:prepare -- --run-checks
```

`--run-checks` esegue `npm run prepush:guard`. Per modifiche UI sostanziali resta
necessario aggiungere `npm run smoke:a11y`; per schema, RLS, Storage o auth
aggiungi i check Supabase indicati nella checklist di sicurezza.

### Stato integrazione

Al 2026-05-03 la filiera operativa gratuita è completa:

- GitHub è la fonte primaria del codice.
- Il workflow `Quality` gira sulle PR verso `main` e può essere avviato manualmente.
- Vercel crea preview da branch/PR e pubblica la produzione da `main`.
- La produzione ufficiale è `https://pratix.vercel.app`.
- Il repository non richiede segreti GitHub per il workflow `Quality`.

Le verifiche che restano periodiche, e non bloccanti per il codice, sono:

- leggere Web Analytics e Speed Insights dopo traffico reale;
- controllare Vercel Observability dopo errori, lentezza percepita o deploy
  runtime;
- controllare nei log Vercel il run schedulato del cron dopo le 06:00 UTC;
- aggiungere redirect preview in Supabase solo quando serve testare auth su una preview.

## Quando serve verificare Vercel

Vercel crea comunque deployment automatici quando una PR viene aperta o quando
`main` riceve un merge. Questo non significa che ogni modifica debba bloccare il
lavoro su una verifica funzionale completa.

- **Documentazione interna non esposta all'app** (`AGENTS.md`, `README.md`,
  `docs/**` operative): non serve attendere o verificare Vercel oltre ai check
  GitHub pertinenti.
- **Documenti o release esposti nella UI** (`CHANGELOG.md`, `src/lib/version.ts`,
  testi pubblici, landing, privacy, termini): verifica almeno che il deployment
  production sia `READY` e che la pagina interessata risponda.
- **Codice, configurazione runtime, auth, routing, Supabase o UI**: segui il
  normale giro Quality + preview/production Vercel proporzionato al rischio.

Se Vercel deploya automaticamente una modifica docs-only interna, trattalo come
effetto collaterale a basso rischio: non serve prolungare il task solo per uno
smoke visivo.

## Variabili d'ambiente

Configurare in Vercel Project Settings → Environment Variables:

- `VITE_SUPABASE_URL` — client e server, Production e Preview.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — client e server, Production e Preview.
- `VITE_SUPABASE_PROJECT_ID` — client e server, Production e Preview.
- `VITE_TURNSTILE_SITE_KEY` — chiave pubblica Cloudflare Turnstile, Production e Preview quando CAPTCHA Supabase è attivo.
- `VITE_ENABLE_PASSKEYS` — opzionale; impostare a `true` solo quando Supabase Auth/WebAuthn è abilitato sul progetto hosted.
- `SUPABASE_URL` — server, Production e Preview.
- `SUPABASE_PUBLISHABLE_KEY` — server, Production e Preview.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, Production; necessaria per il keep-alive Supabase del cron giornaliero.
- `CRON_SECRET` — server-only, Production; Vercel lo usa come bearer token per il cron giornaliero.

`SUPABASE_SERVICE_ROLE_KEY` è server-only: non va mai esposta al client.
`VITE_TURNSTILE_SITE_KEY` è pubblica per design; la secret key Turnstile vive
solo nelle impostazioni Supabase Auth.

Per ora Pratix usa un solo progetto Supabase anche per le preview Vercel. Di
conseguenza le preview servono a verificare build, routing e UI; non sono un
ambiente per test distruttivi sui dati. Un secondo Supabase free può essere
valutato solo se resta davvero dentro i limiti gratuiti disponibili.

In GitHub Secrets non serve duplicare le variabili Vercel. Inserisci solo
segreti necessari a workflow CI specifici. Il workflow `Quality` attuale non
richiede segreti.

### Regola secret e backup

GitHub conserva solo codice, configurazione pubblicabile e migrations. La
`.env` tracciata contiene esclusivamente URL, project id e publishable key
Supabase; i secret runtime restano fuori dal repo.

- Vercel: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` e altri secret server-only.
- Supabase: secret provider come Turnstile secret o Custom SMTP quando attivi.
- Locale: `.env.local` per test manuali, ignorato da Git.
- Backup: dump, export e archivi in una cartella fuori dal repository o in un
  archivio cifrato, mai in GitHub.

Prima di pubblicare, controlla che `git status --ignored --short` non mostri
backup o file secret pronti per lo stage.

## Osservabilità Vercel

Pratix include i componenti ufficiali Vercel Web Analytics e Speed Insights nel
root React. In produzione gli script `/_vercel/insights/script.js` e
`/_vercel/speed-insights/script.js` devono essere serviti dal dominio Vercel.
Per leggere i dati:

1. Apri Vercel Project → Analytics e abilita Web Analytics.
2. Apri Vercel Project → Speed Insights e abilita Speed Insights.
3. Verifica dopo qualche visita reale, perché i dati non arrivano dal server
   locale e possono impiegare tempo a comparire.

Non aggiungere eventi custom con dati personali, nomi clienti, importi o dati di
fatture. Per ora bastano pagine viste e metriche di performance aggregate.

### Runtime logs e Observability

La strategia scelta è Vercel-first: niente Sentry o altri servizi finché i log
runtime, Web Analytics e Speed Insights bastano a diagnosticare produzione.

Usa Vercel Observability per:

- errori o timeout in funzioni server;
- regressioni dopo deploy;
- lentezza percepita in preview o produzione;
- verifica del cron giornaliero.

Le route API e le server functions che fanno lavoro non banale devono loggare
JSON strutturato con almeno:

- `level`;
- `message`;
- `route` o nome funzione;
- `requestId`, quando disponibile da `x-vercel-id`;
- `ms` durata;
- nessun dato personale, nome cliente, importo, contenuto fattura o secret.

L'endpoint `/api/cron/daily` segue già questo formato con eventi
`cron_secret_missing`, `cron_unauthorized`, `supabase_keepalive_completed`,
`supabase_keepalive_failed` e `cron_completed`. Quando aggiungi nuovi endpoint
pubblici o cron, parti dallo stesso pattern.

Se una diagnosi richiede log più ricchi, aggiungi campi tecnici a bassa
sensibilità (`status`, `count`, `feature`, `environment`) e rimuovili quando
non servono più. Non inviare eventi custom di analytics per azioni su pratiche,
clienti o fatture senza una decisione esplicita privacy/prodotto.

## Cron giornaliero

`vercel.json` registra un solo cron Hobby-compatible:

- path: `/api/cron/daily`
- schedule: `0 6 * * *` (06:00 UTC, 08:00 in Italia durante l'ora legale)

L'endpoint rifiuta ogni richiesta senza header `Authorization: Bearer
$CRON_SECRET`. Prima del merge in produzione crea `CRON_SECRET` in Vercel
Production; senza questa variabile il cron risponde `503` e non esegue nulla.

Il comportamento di protezione atteso è un `401` con log Vercel
`cron_unauthorized` quando l'endpoint viene chiamato senza secret. Il successo
schedulato produce invece `supabase_keepalive_completed` e `cron_completed`;
controllarli dopo il primo run successivo al deployment.

Il cron esegue anche una query `head` minima su `profiles` tramite client
server-side Supabase. Serve a generare attività reale sul progetto Supabase e a
rilevare errori di connessione, senza leggere dati utente né aggiungere tabelle.
È un keep-alive best-effort per il piano gratuito: non sostituisce la garanzia
ufficiale del piano Pro contro la pausa per inattività.

Se il segnale giornaliero Vercel non fosse sufficiente, il fallback operativo è
ispirato a SyncBay: una schedule Supabase Cron con `pg_cron`/`pg_net` che invoca
lo stesso endpoint protetto e legge il secret da Supabase Vault. Questo passo va
applicato manualmente con SQL linked, senza committare secret o valori Vault nel
repo, e va documentato dopo la verifica del run remoto.

## Supabase Auth

Nel progetto Supabase:

- Site URL: `https://pratix.vercel.app/`
- Redirect URL principali:
  - `https://pratix.vercel.app/dashboard`
  - `https://pratix.vercel.app/reimposta-password`

Le preview Vercel possono essere aggiunte come redirect separati quando serve
testare flussi auth su branch.

Se la Deployment Protection Vercel è attiva sulle preview, evita fetch assoluti
verso URL generati e preferisci path relativi nelle chiamate interne.

## Preview Vercel

Nel piano Hobby usa Vercel Authentication con protezione standard per le
preview e gli URL di deployment. La produzione su `https://pratix.vercel.app`
resta pubblica.

Impostazioni consigliate nel dashboard Vercel:

- Deployment Protection: Vercel Authentication sulle preview e sugli URL di deployment.
- Vercel Toolbar: attiva sulle preview per commenti e debug visivo.
- Comments: attivi sulle preview, non necessari in produzione.
- Instant Rollback: usare dal dashboard Deployment → Rollback se `main` pubblica una regressione.

Non creare un secondo progetto Supabase per le preview nel percorso gratuito
attuale. Le preview usano lo stesso backend: vanno bene per build, routing e UI,
non per test distruttivi sui dati.

Verifiche minime su ogni preview:

- login e logout;
- navigazione nelle route principali;
- pagine legacy `/recupera-password` e `/reimposta-password` mostrano il percorso senza password e rimandano al login via email;
- nessun errore evidente nei log Vercel;
- nessun test distruttivo sul database condiviso.

## Dominio

Il dominio gratuito ufficiale è `https://pratix.vercel.app`.

Un dominio custom su Vercel resta opzionale. Il custom domain Supabase non è
necessario per Pratix e non fa parte del percorso gratuito attuale.

## Sicurezza prima di pubblicare

Checklist minima:

- [ ] PR verso `main` aperta e workflow `Quality` completato
- [ ] Preview/production Vercel verificata quando il diff tocca superfici esposte o runtime
- [ ] Vercel Observability/log runtime controllati quando cambia codice server, cron o deploy
- [ ] `npm run build` ok
- [ ] `npm run lint` ok oppure issue note e non correlate alla modifica
- [ ] `npm audit --audit-level=moderate` ok se sono cambiate dipendenze
- [ ] Supabase advisors verificati quando cambiano schema, RLS, Storage o auth
- [ ] Login passwordless via link email verificato
- [ ] Pagine Privacy e Termini presenti
- [ ] Meta tag e og:image sulle pagine pubbliche
- [ ] Errori auth generici (no enumeration)

Vedi [SECURITY.md](../../SECURITY.md) e [ROADMAP.md](../ROADMAP.md) per lo stato.
