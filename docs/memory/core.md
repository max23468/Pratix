# Memoria — Core

> Mirror di `mem://index.md` (sezione _Core_). Regole sempre attive, applicate a ogni intervento sul progetto.

## Brand e prodotto

- **Nome**: Pratix, gestionale per avvocati freelance.
- **Personalità**: professionale moderno.
- **Tagline ufficiale**: **"Tutto torna."** (sempre col punto, mai tradurre, mai dentro la UI autenticata). Nei title/meta usa sempre `·`: `Dashboard · Pratix`. La forma `Pratix · Tutto torna.` è riservata alla home pubblica.

## Palette

- **Navy primario**: `oklch(0.30 0.07 255)`
- **Oro brunito accento**: `oklch(0.68 0.11 75)`
- **Sfondo light**: panna `oklch(0.985 0.004 80)` — mai bianco puro
- **Sfondo dark**: grigio caldo neutro `oklch(0.18 0.012 250)` — croma bassa, riposante per gli occhi
- Solo token semantici, **mai hex inline**

### Token brand FISSI (uguali in light/dark)

- `--color-brand-navy`
- `--color-brand-cream`
- `--color-brand-gold`

Da usare per logo e asset di marca che non devono invertirsi col tema.

## Tema

- **Auto** (segue sistema) + **override manuale** chiaro/scuro
- Provider: `src/lib/theme-context.tsx`
- Toggle `<ThemeToggle>` in **sidebar + landing + impostazioni**
- No-flash script in `__root.tsx`

## Tipografia

- **Inter Tight** display (h1/h2/h3 via `.font-display`)
- **Inter** UI
- **JetBrains Mono** monospace
- Numeri sempre `tabular-nums`
- Display weight max **600**

## Logo

- Usa solo `<Logo>` da `src/components/brand/logo.tsx`
- Direzione default `px`
- **Mai SVG inline**
- Favicon `/favicon.svg`

## Tono di voce

- **"tu"** professionale neutro
- No emoji UI
- No esclamativi multipli
- No "Oops"
- Frasi brevi, stato del sistema

## Glossario obbligatorio

✅ Committente · Cliente · Controparte · Pratica · Attività · Compenso/Onorario · Prezzi · Rimborso spese · Fattura · Rendiconto Excel · Bollo/Marca da bollo
❌ Caso · Assistito · Deadline · Costi

Pratix resta per avvocati freelance, non per studi associati o team multi-ruolo. "Studio" non è più vietata in assoluto, ma non va usata per riposizionare il prodotto verso studi associati. **Attività** è ora termine centrale: indica le registrazioni operative e fatturabili dentro una pratica. La sezione `/attivita` è la vista globale di inserimento rapido; la tab nella pratica resta la vista contestuale delle stesse righe.
Fallback intestazione fattura: **"Avvocato"**.

## Processo

Ogni decisione di prodotto/brand/tecnica condivisa in chat deve confluire in [`ROADMAP.md`](../../ROADMAP.md). Aggiornare stato (✅ 🟡 ⬜ 💤) a ogni cambio.

Se il worktree contiene modifiche non collegate alla richiesta, non mescolare filoni diversi: per interventi non minuscoli usa un branch/worktree dedicato da base pulita; per interventi piccoli lavora nello stesso checkout solo se i file non si sovrappongono e segnala l'assunzione.

Quando un lavoro su PR/branch dedicato viene mergeato, pubblicato o chiuso, pulire anche il checkout locale: controllare `git branch -vv` e `git worktree list`, eliminare i branch con upstream `gone` o già assorbiti e non lasciare branch `codex/*` stale né worktree temporanei residui. Usare prima `git branch -d <branch>`; se Git rifiuta perché il branch non è antenato diretto ma `git log --cherry-pick --right-only --oneline main...<branch>` non mostra commit unici, è ammesso `git branch -D <branch>`. Per ogni worktree temporaneo controllare `git -C <path> status -sb` e rimuoverlo con `git worktree remove <path>`; se restano solo artefatti ignorati/generati dopo lo sgancio, ispezionare la directory e rimuoverla. Ogni branch remoto, branch locale o directory worktree lasciata aperta deve avere un motivo esplicito nel riepilogo.

Pratix resta un gestionale leggero per avvocati freelance, ora focalizzato prevalentemente sul recupero crediti. Nuove funzionalità devono rafforzare committenti, clienti, controparti, pratiche, attività fatturabili, compensi/onorari, prezzi per committente, rimborsi spese Art. 15, rendiconti Excel, fatture, sicurezza dati, qualità operativa o affidabilità del SaaS. Evita espansioni verso studi associati, CRM generalista, suite contabile completa, piattaforme enterprise, bot Telegram o VPS-first senza decisione esplicita e ADR.

Per modifiche UI sostanziali verifica quando praticabile desktop/mobile e chiaro/scuro. `npm run smoke:a11y` o `npm run smoke:a11y:auth` sono gate di chiusura proporzionati per UI ampia, routing, componenti condivisi, flussi autenticati critici, release o publish in corsia completa; `npm run smoke:a11y:quick` copre invece sanity UI mirate. Non sono obbligatori smoke per analisi, docs interne, microcopy o fix locali a basso rischio. Per questi casi scegli controlli mirati, rilettura/coerenza o `format:changed:check` quando utile. Nelle risposte finali cita verifiche solo quando aggiungono valore: fallimenti, limiti, rischi residui o comandi rilevanti.

Per ogni richiesta "pubblica", distinguere il traguardo operativo dalla profondità dei test: pubblicazione completa resta PR/merge su `main`, Vercel production `READY` quando serve e cleanup branch/worktree, ma i gate seguono tre corsie. Corsia veloce per docs interne, roadmap, ADR, regole agenti, memoria o `Non versionato` non esposto in app: rilettura/coerenza, `git diff --check`, `format:changed:check` se utile, senza build/lint/test/smoke se non cambia codice, runtime, UI o contenuti esposti. Corsia standard per changelog, testi pubblici, microcopy esposta o piccola UI: check specifici, eventuale build/lint se il diff tocca TypeScript/config, verifica pagina o HTTP mirata, `smoke:a11y:quick` se serve sanity UI. Corsia completa per parser, automazione release, routing, componenti condivisi, auth, database, dipendenze o UI sostanziale: `prepush:guard` o equivalenti e smoke quando praticabile. Dopo il merge, `publish:finish` aggiorna main, verifica Vercel/route e pulisce branch/worktree dedicati con operazioni sicure.

Ogni volta che termini un'attività, suggerisci sempre i prossimi passi consigliati: devono essere concreti, ordinati e proporzionati al lavoro appena concluso. Se non c'è un seguito operativo reale, dichiaralo esplicitamente.

Il pre-push usa `npm run prepush:guard`: seleziona i controlli in base al diff tracciato, ignora file non tracciati, usa `origin/main` quando una branch non ha upstream, calcola la fingerprint dal contenuto dei diff e salva una cache locale, così un push ripetuto non rilancia format/build/lint/audit senza motivo. I check indipendenti girano in fasi parallele; `PRATIX_CHECKS_SEQUENTIAL=1` forza il modo sequenziale se serve diagnosticare log o flakiness. `PRATIX_SKIP_PREPUSH=1 git push` è ammesso solo quando i controlli equivalenti sono già stati eseguiti sullo stesso diff e il motivo viene dichiarato.

Prettier è un gate esplicito: `npm run format:changed:check` verifica solo i file tracciati cambiati e `npm run format:changed` corregge solo quei file. Il workflow GitHub usa lo stesso controllo sui file modificati prima di build/lint, così gli errori di formattazione emergono subito e non come rumore dentro ESLint.

I commenti del bot Codex si gestiscono tramite la issue GitHub `Codex feedback inbox`: il workflow usa eventi PR trusted, esegue sempre lo script dalla default branch trusted, deduplica eventuali issue inbox duplicate, compatta lo storico mostrato, alterna scansioni mirate a scansioni complete ogni 6 ore e commenta `@codex address that feedback` sui thread actionable. Non usare più file Markdown di stato committati nel repo per questa inbox.

Vercel deploya automaticamente da PR/main, ma le modifiche solo documentali non esposte all'app non devono bloccare la chiusura su una verifica Vercel. Per `CHANGELOG.md`, `src/lib/version.ts`, testi pubblici o runtime verifica invece almeno deployment `READY` e pagina interessata.

Pubblicare su GitHub/main non significa sempre rilasciare una nuova versione.
Piani, ADR, guide interne, PDF di pianificazione e regole agenti che non
cambiano app, runtime, contenuti esposti o supporto a una versione già
rilasciata vanno nel changelog come `Non versionato` e non devono modificare
`src/lib/version.ts`.

## Stack

TanStack Start + Supabase di proprietà + Vercel. Supabase Auth usa il percorso
passwordless via link email; le passkey restano dietro `VITE_ENABLE_PASSKEYS=true`
finché WebAuthn non è disponibile sul progetto hosted. Supabase Storage usa il
bucket privato `pratix-documents` con path owner-scoped `<user_id>/<area>/...`.
Observability resta Vercel-first: Web Analytics, Speed Insights e runtime logs
strutturati prima di introdurre servizi esterni. Lingua italiana, `lang="it"`.
**Mai modificare**: `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`, `.env`.
