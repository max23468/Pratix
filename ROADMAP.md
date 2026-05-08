# Roadmap — Pratix

> Documento vivo. Ogni decisione di prodotto, brand o tecnica condivisa in chat
> deve confluire qui. Aggiornare quando una voce cambia stato o ne emergono di nuove.
>
> Riferimenti: [`BRAND.md`](./BRAND.md), [`AGENTS.md`](./AGENTS.md), memoria di
> progetto in `mem://index.md`.

Legenda stato: ✅ fatto · 🟡 in corso · ⬜ da fare · 💤 idea / parcheggiato

---

## 0. Identità e brand

| Stato | Voce                                                      | Note                                                                                                                                                                           |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅    | Nome prodotto: **Pratix**                                 | Gestionale per avvocati freelance                                                                                                                                              |
| ✅    | Tagline ufficiale: **"Tutto torna."**                     | Triplo senso: contabile, narrativo, ordine. Fuori dalla UI autenticata. Nei title usa `·`: `Dashboard · Pratix`; `Pratix · Tutto torna.` solo in home                          |
| ✅    | Palette inchiostro + terracotta + panna                   | Token semantici in `src/styles.css`, mai hex inline. Differenziazione da Fineco/banche (ADR-0007). I nomi token `--brand-navy/gold` sono alias storici                         |
| ✅    | Logo adattivo cross-tema                                  | Tone `navy` cambia tile/glifo fra light e dark via token `--logo-*`                                                                                                            |
| ✅    | Tipografia: Inter Tight + Inter + JetBrains Mono          | Numeri tabular-nums, display weight max 600                                                                                                                                    |
| ✅    | Logo unificato `<Logo>` + favicon SVG                     | Direzione default `px`, mai SVG inline                                                                                                                                         |
| ✅    | Tono di voce "tu" professionale                           | No emoji UI, no esclamativi multipli                                                                                                                                           |
| ✅    | Glossario freelance + recupero crediti                    | Committente/Cliente/Controparte/Pratica/Attività/Compenso-Onorario/Prezzi/Rimborso spese/Fattura/Rendiconto Excel; Attività è label ufficiale per le registrazioni fatturabili |
| ⬜    | Pagina `/brand` o sezione interna riassuntiva             | Non urgente; per ora basta `BRAND.md`                                                                                                                                          |
| 💤    | Loghi alternativi (orizzontale scuro su panna, monocromo) | Solo se serviranno per export/press                                                                                                                                            |

## 1. Tema e accessibilità

| Stato | Voce                                                | Note                                            |
| ----- | --------------------------------------------------- | ----------------------------------------------- |
| ✅    | Tema auto (sistema) + override manuale chiaro/scuro | Provider `src/lib/theme-context.tsx`            |
| ✅    | Toggle in sidebar, landing, impostazioni            | `<ThemeToggle>`                                 |
| ✅    | No-flash script in `__root.tsx`                     | Evita FOUC al caricamento                       |
| ✅    | Dark mode "rilassante"                              | Grigio caldo neutro, croma bassa                |
| ⬜    | Audit contrasto WCAG AA su entrambi i temi          | Specie su muted, gold su panna, success/warning |
| ⬜    | Focus visibili e navigazione tastiera               | Verifica su tutte le route                      |
| ⬜    | Riduci-movimento (`prefers-reduced-motion`)         | Disabilitare animazioni non essenziali          |

## 2. Landing pubblica

| Stato | Voce                                           | Note                                                           |
| ----- | ---------------------------------------------- | -------------------------------------------------------------- |
| ✅    | Hero con tagline + CTA                         | "Tutto torna." come ancora visiva                              |
| ⬜    | Sezione "Perché Pratix" orientata al freelance | Tre/quattro promesse concrete                                  |
| ⬜    | Mockup/screenshot di prodotto                  | Dashboard, fattura, pratica                                    |
| ⬜    | Pricing                                        | Decidere modello: free/trial/pro, mensile/annuale              |
| ⬜    | FAQ                                            | Domande tipiche: regime forfettario, FatturaPA, sicurezza dati |
| ✅    | Footer con Privacy e Termini                   | Pagine `/privacy` e `/termini` linkate                         |
| ✅    | Meta + og:image dedicati alla landing          | og + twitter cards in root, immagine `/og-image.jpg`           |
| ⬜    | Footer completo con contatti e P.IVA           | Da aggiungere quando definiti gli estremi del titolare         |

## 3. Esperienza prodotto (UI autenticata)

| Stato | Voce                               | Note                                                                                                                                                                     |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅    | Layout app + sidebar               | `src/components/app-layout.tsx`                                                                                                                                          |
| ✅    | Onboarding wizard 3 step           | Anagrafica / Fiscale / Pagamenti                                                                                                                                         |
| ⬜    | Empty states uniformi              | Dashboard, Pratiche, Clienti, Fatture, Attività                                                                                                                          |
| ✅    | Revisione superfici trasversali    | Dashboard, filtri/empty state, viste pratiche, Impostazioni, Account, Novità, onboarding, landing, privacy/termini e audit visuale allineati al dominio recupero crediti |
| ⬜    | Microcopy review pagina per pagina | Coerenza tono, glossario, "tu"                                                                                                                                           |
| ⬜    | Scorciatoie tastiera               | Almeno: nuova pratica, nuovo cliente, nuova fattura, ricerca globale                                                                                                     |
| ⬜    | Ricerca globale (cmd+k)            | Pratiche, clienti, fatture                                                                                                                                               |
| ⬜    | Filtri persistenti per pagina      | Salvare in URL/query                                                                                                                                                     |
| ⬜    | Dati di esempio opzionali          | Per esplorare l'app a freddo                                                                                                                                             |

## 4. Funzionalità di prodotto

| Stato | Voce                              | Note                                                                                                                                                                 |
| ----- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅    | Pratiche, Clienti, Fatture base   | CRUD + visualizzazione                                                                                                                                               |
| ✅    | Generazione fattura PDF           | `src/lib/invoice-pdf.ts`                                                                                                                                             |
| ✅    | Generazione XML FatturaPA (TD06)  | `src/lib/invoice-xml.ts`                                                                                                                                             |
| ✅    | Piano evoluzione recupero crediti | Piano chiuso lato prodotto il 2026-05-08 in `docs/plans/evoluzione-recupero-crediti.md`; residui non bloccanti tracciati in roadmap                                  |
| ✅    | Rimozione scadenzario             | Route, sidebar, dashboard, tab pratica e tabella `case_deadlines` rimossi                                                                                            |
| ✅    | Schema recupero crediti Fase 2    | Migration applicata, tipi Supabase rigenerati e snapshot SQL aggiornato                                                                                              |
| ✅    | Committenti                       | Anagrafica soggetto fatturato e regole economiche di base                                                                                                            |
| ✅    | Clienti multi-committente         | Relazione molti-a-molti fra committenti e clienti                                                                                                                    |
| ✅    | Controparti strutturate           | Persone/società e gruppi di soggetti senza ruoli                                                                                                                     |
| ✅    | Prezzi per committente            | Compensi/rimborsi abilitabili per committente, voci e prezzi unitari personalizzabili per anno                                                                       |
| ✅    | Attività fatturabili              | Sezione globale `/attivita` + tab pratica; voci da Prezzi, stato da fatturare/fatturata, quantità, udienze e allegati facoltativi                                    |
| ✅    | Fatturazione committente/periodo  | Estrazione attività per committente/periodo, inclusione/rinvio/esclusione, spese generali opzionali, cassa forense su compensi + spese generali e rendiconti Excel   |
| ✅    | Import archivio guidato           | Procedura manuale ed Excel strutturato dal menu Account con staging/anteprima, conferma transazionale e allegati sulle attività storiche                             |
| ⬜    | Collaudo import reale/semi-reale  | Test manuale con dati anonimizzati o inventati ma aderenti all'archivio cartaceo: staging, conferma, allegati e fatturazione successiva                              |
| 💤    | Time tracking per pratica         | Fuori dal perimetro recupero crediti attuale                                                                                                                         |
| ✅    | Spese con allegati                | I rimborsi sono attività fatturabili Art. 15 con allegati; il flusso fatture usa `case_activities` e la tabella legacy `expenses` è in dismissione tramite migration |
| ⬜    | Esportazione massiva fatture      | ZIP PDF + XML per periodo                                                                                                                                            |
| ✅    | Numerazione automatica            | Numero pratica numerico suggerito dal database e modificabile manualmente                                                                                            |
| 💤    | Area cliente esterna              | Login dedicato per visione fatture e documenti                                                                                                                       |
| 💤    | Integrazione invio SDI            | Oggi solo generazione XML; invio futuro                                                                                                                              |

## 5. Account, sicurezza, dati

| Stato | Voce                                         | Note                                                                                                                            |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| ✅    | Registrazione + login                        | Email/password                                                                                                                  |
| ✅    | Recupero password                            | Pagine `/recupera-password` + `/reimposta-password`, email Supabase di default                                                  |
| ✅    | Messaggi auth generici (no user enumeration) | Login e registrazione                                                                                                           |
| ✅    | Area Account separata da Impostazioni        | `/account` con tab Profilo / Accesso e sicurezza / Aspetto / Notifiche, accesso da menu utente in topbar                        |
| ✅    | Cambio password in-app                       | Riautenticazione con password attuale + `auth.updateUser`                                                                       |
| ✅    | CAPTCHA Auth predisposto ma non attivo       | Supporto Turnstile nel codice se `VITE_TURNSTILE_SITE_KEY` è configurata; integrazione Cloudflare non attiva per scelta attuale |
| ✅    | Registrazione con conferma email             | Registrazione aperta; se Supabase richiede conferma, la UI mostra lo stato email invece di forzare la dashboard                 |
| ✅    | Template email auth in italiano              | Template Supabase attivi per conferma account e recupero password; Custom SMTP/dominio dedicato non necessari ora               |
| ✅    | Supabase Storage privato                     | Bucket `pratix-documents` con policy owner-scoped per documenti, fatture, allegati, asset profilo ed export                     |
| 💤    | Leaked Password Protection Supabase          | Richiede piano Pro o superiore; non prevista nel percorso gratuito attuale                                                      |
| ⬜    | Cambio email                                 | Con conferma sul nuovo indirizzo                                                                                                |
| ⬜    | Eliminazione account                         | Soft + hard delete con conferma                                                                                                 |
| ⬜    | Esportazione dati personali                  | JSON/CSV per GDPR                                                                                                               |
| ⬜    | Audit RLS su tutte le tabelle                | Verifica policy per `user_id`                                                                                                   |
| ⬜    | Auth Google opzionale                        | Da valutare in base al target                                                                                                   |

## 6. SEO, pubblicazione, dominio

| Stato | Voce                                           | Note                                                                                                                                              |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅    | `lang="it"` su root                            |                                                                                                                                                   |
| ✅    | Meta unici per route pubbliche                 | Landing, login, registrazione, recupero, privacy, termini                                                                                         |
| ✅    | og:image globale + Twitter card                | `/og-image.jpg`                                                                                                                                   |
| ✅    | `sitemap.xml` + `robots.txt`                   | Sitemap pubblica per home, novità, privacy e termini; robots con esclusione di aree riservate e pagine operative di accesso                       |
| ⬜    | JSON-LD `Organization` / `SoftwareApplication` |                                                                                                                                                   |
| ✅    | Uscita tecnica da Lovable                      | GitHub + Vercel + Supabase attivi; produzione verificata su `https://pratix.vercel.app`; Lovable resta solo parcheggiato come archivio temporaneo |
| ✅    | Pubblicazione tramite Vercel                   | Produzione su `https://pratix.vercel.app`; dominio proprietario rimandato                                                                         |
| ✅    | Migrazione backend fuori da Lovable Cloud      | Supabase di proprietà collegato, dati migrati, auth verificata                                                                                    |
| ✅    | Bonifica riferimenti Lovable                   | Runtime, configurazione e docs operative pulite; restano solo riferimenti storici censiti in `docs/migration/lovable-reference-audit.md`          |
| 💤    | Dismissione definitiva Lovable                 | Progetto Lovable lasciato inattivo per prudenza; in futuro verificare/rimuovere GitHub App Lovable e chiudere il progetto se non serve più        |
| 💤    | Dominio proprietario futuro                    | Eventuale dominio tipo `pratix.it`                                                                                                                |

## 7. Qualità e processo

| Stato | Voce                                          | Note                                                                                                                                                                                                                                          |
| ----- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅    | `AGENTS.md` con regole operative              |                                                                                                                                                                                                                                               |
| ✅    | `BRAND.md` con guidelines                     |                                                                                                                                                                                                                                               |
| ✅    | `ROADMAP.md` con stato per area               | Questo file                                                                                                                                                                                                                                   |
| ✅    | `README.md` di ingresso                       | Panoramica + mappa documenti                                                                                                                                                                                                                  |
| ✅    | `CHANGELOG.md` (Keep a Changelog)             | Storico release                                                                                                                                                                                                                               |
| ✅    | `SECURITY.md` + `CONTRIBUTING.md` + `LICENSE` | Predisposti per repo pubblico                                                                                                                                                                                                                 |
| ✅    | Cartella `docs/` con guide tematiche          | architettura, database, fatturazione, tema, tono di voce, deploy                                                                                                                                                                              |
| ✅    | `docs/memory/` mirror di `mem://`             | core, brand, roadmap                                                                                                                                                                                                                          |
| ✅    | `docs/decisions/` con 15 ADR                  | Stack, backend storico, FatturaPA, tagline, target freelance, tema, palette, versioning, uscita Lovable, release automatizzata, gestione commenti Codex, storage/observability, focus recupero crediti, Attività                              |
| ✅    | `docs/glossario.md`                           | Termini legali e fiscali italiani                                                                                                                                                                                                             |
| ✅    | Memoria di progetto sincronizzata             | `mem://index.md` + `mem://design/brand` + `mem://process/roadmap`                                                                                                                                                                             |
| ✅    | **Versioning + Changelog + pagina Novità**    | `src/lib/version.ts` + parser `CHANGELOG.md` + route `/novita` autenticata + campanella in topbar. `npm run release` automatizza bump, data, chiusura changelog e nuovo blocco `[Non rilasciato]`. ADR-0008/0010 e guida versioning           |
| ✅    | **Categorie changelog ridisegnate**           | Tre sezioni standard `Novità` / `Correzioni` / `Sotto il cofano`. La pagina `/novita` mette in evidenza le Novità, mantiene compatte le Correzioni e collassa le voci tecniche. Compatibile con voci storiche (Aggiunto/Modificato/Sicurezza) |
| ✅    | **Schema DB su GitHub**                       | `supabase/schema.sql` baseline + `docs/data-model.md` narrativo + `docs/guides/migrations.md` per il flusso operativo                                                                                                                         |
| ✅    | **Templates GitHub + Dependabot**             | `.github/ISSUE_TEMPLATE/` (bug, idea), `PULL_REQUEST_TEMPLATE.md`, `dependabot.yml` (npm + GitHub Actions settimanali, minor/patch raggruppati)                                                                                               |
| ✅    | **Quality gate GitHub leggero**               | `.github/workflows/quality.yml` su PR verso `main` e avvio manuale: `npm ci`, build, lint sui sorgenti modificati, audit solo se cambiano `package.json` o `package-lock.json`                                                                |
| ✅    | **Inbox event-driven commenti Codex**         | `.github/workflows/codex-pr-comments.yml` usa eventi PR trusted, deduplica la inbox, compatta lo storico e alterna scansioni mirate a scansioni complete periodiche                                                                           |
| ✅    | **Guardrail agenti rafforzati**               | `AGENTS.md` chiarisce worktree sporco, perimetro/non-obiettivi, verifica UI sostanziale, riepiloghi finali senza footer rituali e prossimi passi consigliati a fine attività                                                                  |
| ✅    | **Pre-push intelligente**                     | `.githooks/pre-push` usa `scripts/prepush-guard.mjs` per selezionare build/lint/audit in base al diff, ignorare file non tracciati e usare `origin/main` se la branch non ha upstream                                                         |
| ✅    | **Gate Prettier esplicito**                   | `format:changed:check` verifica i file tracciati cambiati in locale e in PR prima di build/lint; `format:changed` corregge solo il diff senza riscrivere tutto il repo                                                                        |
| ✅    | **Verifica Vercel proporzionata**             | Le docs interne non esposte non bloccano su Vercel; release, testi pubblici, UI e runtime richiedono verifica deployment proporzionata                                                                                                        |
| ✅    | **Update latest dipendenze e toolchain**      | Dipendenze, toolchain, runtime Node/npm, workflow CI e CLI operative aggiornati o verificati; piano e residui tracciati in `docs/plans/update-latest-dipendenze.md`                                                                           |
| ✅    | **Web Analytics + Speed Insights Vercel**     | Componenti ufficiali caricati in produzione; dashboard da leggere dopo traffico reale senza eventi custom                                                                                                                                     |
| ✅    | **Observability Vercel-first**                | Runtime logs strutturati, Web Analytics e Speed Insights come baseline; niente Sentry finché la diagnostica Vercel basta                                                                                                                      |
| ✅    | **Cron Vercel giornaliero protetto**          | `/api/cron/daily` schedulato via `vercel.json`, protetto da `CRON_SECRET`; endpoint e log di protezione verificati, run schedulato da controllare dopo il prossimo giro                                                                       |
| ✅    | **Integrazione Vercel preview**               | Preview deployment da branch/PR attivi; test auth su preview solo quando le redirect URL vengono aggiunte in Supabase                                                                                                                         |
| ✅    | **Governance Supabase free**                  | Un solo progetto Supabase; migrations manuali con dry-run/advisors, hardening free completato, secret nei provider e backup logico manuale fuori repo                                                                                         |
| ✅    | **Guida uscita Lovable**                      | Migrazione tecnica completata; la guida resta come storico e checklist di eventuale dismissione Lovable                                                                                                                                       |
| ⬜    | **Strategia test automatizzati progressiva**  | Definire stack e perimetro test: unit test su logica pura, integration test su server functions/parser/calcoli, smoke/e2e sui flussi auth, pratiche e fatture, fixture anonime, script `npm test` e integrazione graduale in Quality/pre-push |
| ⬜    | Test automatici recupero crediti              | Numero pratica, snapshot prezzi, attività rinviate, blocco attività fatturate, rendiconti Excel e RLS                                                                                                                                         |
| ⬜    | Test minimi su funzioni critiche              | XML FatturaPA, calcoli IVA/ritenuta, cassa forense                                                                                                                                                                                            |
| ✅    | Linter pulito su tutto il repo                | `npm run lint`                                                                                                                                                                                                                                |
| ⬜    | `npm audit --audit-level=moderate` periodico  |                                                                                                                                                                                                                                               |

---

## Prossime mosse suggerite (in ordine)

1. **Strategia test automatizzati progressiva**: definire un set minimo di fixture anonime e smoke autenticati per coprire dashboard, pratiche, attività, fatture PDF/XML, import archivio e impostazioni account.
2. **Provare un import archivio reale o semi-reale**: verificare staging, conferma, allegati e successiva fatturazione.
3. **Esportazione massiva fatture**: ZIP PDF + XML per periodo.
4. **Test recupero crediti**: partire da numero pratica, snapshot prezzi, rinvii, attività fatturate, rendiconti Excel e RLS.

> Quando completiamo una voce, aggiorniamo lo stato qui e nella memoria di progetto.
