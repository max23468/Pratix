# Changelog

Tutte le modifiche significative a Pratix sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il versionamento aderisce a [Semantic Versioning](https://semver.org/lang/it/).

## [Non rilasciato]

### Aggiunto
- Documentazione strutturata: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`.
- Cartella `docs/` con guide tematiche (`architettura`, `database`, `fatturazione`, `tema-e-design`, `tono-di-voce`, `deploy`), memoria di progetto esplicitata in markdown, decision log (ADR) e glossario di dominio.
- **Recupero password**: pagina `/recupera-password` (richiesta link via email) e pagina `/reimposta-password` (impostazione nuova password dopo il link), con messaggi generici per evitare user enumeration.
- Link "Password dimenticata?" nella pagina di login.
- **Pagine legali**: `/privacy` e `/termini` con contenuti placeholder professionali in attesa di revisione legale.
- Footer della landing con link a Privacy e Termini.
- **Open Graph + Twitter Card**: `og:image` 1216×640 brandizzata, `og:site_name`, `twitter:title`, `twitter:description`, `twitter:image`.
- **ADR-0007**: nuova decisione "Palette inchiostro + terracotta" con motivazione di differenziazione dal territorio fintech bancario (Fineco, banche commerciali).
- **Token logo adattivi** in `src/styles.css`: `--logo-tile`, `--logo-glyph`, `--logo-border`, `--logo-border-opacity`, `--logo-wordmark`. Permettono al logo di cambiare automaticamente tile e glifo fra light e dark senza sacrificare l'identità.

### Modificato
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
[0.1.0]: #010--2026-04-29
