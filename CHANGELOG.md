# Changelog

Tutte le modifiche significative a Pratix sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il versionamento aderisce a [Semantic Versioning](https://semver.org/lang/it/).

## [Non rilasciato]

### Novità
- **Area Account separata**: il tuo profilo personale, l'email di accesso, il cambio password, il tema e le notifiche vivono ora in `/account`, raggiungibile dal menu utente in alto a destra. `/impostazioni` resta dedicata ai dati della tua attività professionale (anagrafica, fiscale, IBAN, numerazione fatture).
- **Cambio password in autonomia**: nuova sezione "Accesso e sicurezza" in Account. Inserisci la password attuale e la nuova, senza dover passare dal flusso di recupero email.
- **Menu utente in topbar**: nuovo avatar circolare accanto alla campanella, con scorciatoie ad Account, Cambia password, Impostazioni attività e Esci.

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
[0.2.1]: #021--2026-04-29
[0.2.0]: #020--2026-04-29
[0.1.0]: #010--2026-04-29
