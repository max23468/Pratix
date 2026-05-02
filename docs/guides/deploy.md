# Guida — Deploy e pubblicazione

## Modello

Pratix viene pubblicato su **Vercel** dal repository GitHub.

- **Codice**: GitHub (`https://github.com/max23468/Pratix.git`)
- **Hosting**: Vercel
- **Produzione**: `https://pratix.vercel.app`
- **Backend**: Supabase di proprietà del progetto

## Deploy

1. Lavora su branch dedicato.
2. Esegui le verifiche pertinenti in locale.
3. Push su GitHub.
4. Apri una PR verso `main`: GitHub esegue il workflow `Quality`.
5. Vercel crea un deployment di preview dal branch.
6. Quando Quality e preview sono verificati, fai merge su `main`.
7. Vercel pubblica la produzione dal branch `main`.

Il workflow GitHub è volutamente leggero: `npm ci`, `npm run build`, lint solo
sui file sorgente modificati e `npm audit --audit-level=moderate` solo quando
cambiano `package.json` o `package-lock.json`. L'avvio manuale esegue sempre
anche l'audit.

Il repo resta privato e nel percorso gratuito: non basare il processo su branch
protection a pagamento. La protezione reale è la disciplina di PR + Quality +
preview Vercel.

### Stato integrazione

Al 2026-05-03 la filiera operativa gratuita è completa:

- GitHub è la fonte primaria del codice.
- Il workflow `Quality` gira sulle PR verso `main` e può essere avviato manualmente.
- Vercel crea preview da branch/PR e pubblica la produzione da `main`.
- La produzione ufficiale è `https://pratix.vercel.app`.
- Il repository non richiede segreti GitHub per il workflow `Quality`.

Le verifiche che restano periodiche, e non bloccanti per il codice, sono:

- leggere Web Analytics e Speed Insights dopo traffico reale;
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
- `SUPABASE_URL` — server, Production e Preview.
- `SUPABASE_PUBLISHABLE_KEY` — server, Production e Preview.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, Production e Preview solo se serve.
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

## Cron giornaliero

`vercel.json` registra un solo cron Hobby-compatible:

- path: `/api/cron/daily`
- schedule: `0 6 * * *` (06:00 UTC, 08:00 in Italia durante l'ora legale)

L'endpoint rifiuta ogni richiesta senza header `Authorization: Bearer
$CRON_SECRET`. Prima del merge in produzione crea `CRON_SECRET` in Vercel
Production; senza questa variabile il cron risponde `503` e non esegue nulla.

Il comportamento di protezione atteso è un `401` con log Vercel
`cron_unauthorized` quando l'endpoint viene chiamato senza secret. Il successo
schedulato produce invece `cron_completed`; controllarlo dopo il primo run
successivo al deployment.

Il cron oggi è un controllo leggero del runtime. Quando verranno introdotte
notifiche o manutenzioni ricorrenti, aggiungere la logica nello stesso endpoint
o creare un secondo cron solo se resta dentro i limiti gratuiti.

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
- recupero password solo se la redirect URL è configurata in Supabase;
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
- [ ] `npm run build` ok
- [ ] `npm run lint` ok oppure issue note e non correlate alla modifica
- [ ] `npm audit --audit-level=moderate` ok se sono cambiate dipendenze
- [ ] Supabase advisors verificati quando cambiano schema, RLS o auth
- [ ] Recupero password attivo
- [ ] Pagine Privacy e Termini presenti
- [ ] Meta tag e og:image sulle pagine pubbliche
- [ ] Errori auth generici (no enumeration)

Vedi [SECURITY.md](../../SECURITY.md) e [ROADMAP.md](../../ROADMAP.md) per lo stato.
