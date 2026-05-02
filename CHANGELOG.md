# Changelog

Tutte le modifiche significative a Pratix sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il versionamento aderisce a [Semantic Versioning](https://semver.org/lang/it/).

## [Non rilasciato]

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
