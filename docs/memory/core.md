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

✅ Pratica · Cliente · Scadenza · Spese · Fattura
❌ Caso · Assistito · Deadline · Costi

**VIETATA** la parola **"studio"** (target è avvocato freelance, non studio associato).
Usa: _professione_, _la tua professione_, _i tuoi dati professionali_, _rubrica_, oppure giri di parole. **"Attività"** è sconsigliata come label di prodotto perché ambigua (in Pratix indica anche le voci di lavoro fatturabili); resta lecita solo come sostantivo comune nei testi legali.
Fallback intestazione fattura: **"Avvocato"**.

## Processo

Ogni decisione di prodotto/brand/tecnica condivisa in chat deve confluire in [`ROADMAP.md`](../../ROADMAP.md). Aggiornare stato (✅ 🟡 ⬜ 💤) a ogni cambio.

Se il worktree contiene modifiche non collegate alla richiesta, non mescolare filoni diversi: per interventi non minuscoli usa un branch/worktree dedicato da base pulita; per interventi piccoli lavora nello stesso checkout solo se i file non si sovrappongono e segnala l'assunzione.

Pratix resta un gestionale leggero per avvocati freelance. Nuove funzionalità devono rafforzare pratiche, clienti, scadenze, spese, fatture, sicurezza dati, qualità operativa o affidabilità del SaaS. Evita espansioni verso studi associati, CRM generalista, suite contabile completa, piattaforme enterprise, bot Telegram o VPS-first senza decisione esplicita e ADR.

Per modifiche UI sostanziali verifica quando praticabile desktop/mobile e chiaro/scuro. Nelle risposte finali cita verifiche solo quando aggiungono valore: fallimenti, limiti, rischi residui o comandi rilevanti.

Il pre-push usa `npm run prepush:guard`: seleziona i controlli in base al diff e salva una cache locale per la stessa fingerprint, così un push ripetuto non rilancia build/lint/audit senza motivo. `PRATIX_SKIP_PREPUSH=1 git push` è ammesso solo quando i controlli equivalenti sono già stati eseguiti sullo stesso diff e il motivo viene dichiarato.

Vercel deploya automaticamente da PR/main, ma le modifiche solo documentali non esposte all'app non devono bloccare la chiusura su una verifica Vercel. Per `CHANGELOG.md`, `src/lib/version.ts`, testi pubblici o runtime verifica invece almeno deployment `READY` e pagina interessata.

## Stack

TanStack Start + Supabase di proprietà + Vercel. Lingua italiana, `lang="it"`.
**Mai modificare**: `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`, `.env`.
