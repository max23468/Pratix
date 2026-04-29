# Memoria — Core

> Mirror di `mem://index.md` (sezione *Core*). Regole sempre attive, applicate a ogni intervento sul progetto.

## Brand e prodotto

- **Nome**: Pratix, gestionale per avvocati freelance.
- **Personalità**: professionale moderno.
- **Tagline ufficiale**: **"Tutto torna."** (sempre col punto, mai tradurre, mai dentro la UI autenticata).

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
Usa: *professione*, *la tua professione*, *i tuoi dati professionali*, *rubrica*, oppure giri di parole. **"Attività"** è sconsigliata come label di prodotto perché ambigua (in Pratix indica anche le voci di lavoro fatturabili); resta lecita solo come sostantivo comune nei testi legali.
Fallback intestazione fattura: **"Avvocato"**.

## Processo

Ogni decisione di prodotto/brand/tecnica condivisa in chat deve confluire in [`ROADMAP.md`](../../ROADMAP.md). Aggiornare stato (✅ 🟡 ⬜ 💤) a ogni cambio.

## Stack

TanStack Start + Lovable Cloud (Supabase). Lingua italiana, `lang="it"`.
**Mai modificare**: `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`, `.env`.
