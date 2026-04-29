# ADR-0007 — Palette inchiostro + terracotta

Data: 2026-04-29
Stato: Accettata

## Contesto

La palette iniziale di Pratix era **navy `oklch(0.30 0.07 255)` + oro brunito
`oklch(0.68 0.11 75)`** su sfondo panna. Durante la review brand è emerso che
questa combinazione ricorda visivamente Fineco Bank (e in generale il
territorio fintech/bancario italiano: Intesa, BPM, banche commerciali con
"navy istituzionale + accento caldo saturo").

Il target di Pratix è **l'avvocato freelance**, non il professionista
finance/banking. La somiglianza con un brand bancario:

1. confonde il posizionamento (legale editoriale ≠ fintech),
2. avvicina Pratix a un territorio già occupato e fortemente connotato,
3. priva il brand di un'identità riconoscibile nel suo verticale.

## Opzioni valutate

1. **Cambiare solo l'accento** (terracotta / verde bosco / bordeaux).
2. **Spostare il primario** dal navy a inchiostro o grafite.
3. **Tenere la palette ma cambiare la "firma" tipografica** (serif editoriali).
4. **Rifare entrambi**: primario inchiostro + accento terracotta.

Opzione 4 scelta dopo confronto su 3 prototipi visivi
(Inchiostro+Terracotta, Bosco+Ottone, Bordeaux+Grafite).

## Decisione

Adottare la palette **Inchiostro + Terracotta** su sfondo panna:

- **Primario**: inchiostro profondo `oklch(0.22 0.04 260)` — più neutro e
  meno "blu corporate" del navy, evoca penna/codice/editoriale.
- **Accento**: terracotta `oklch(0.62 0.15 35)` — caldo, italiano,
  associato visivamente a toghe, codici rilegati, mattoncino di palazzi
  di giustizia.
- **Sfondo light**: panna `oklch(0.985 0.004 80)` (invariato).
- **Sfondo dark**: grigio caldo neutro `oklch(0.18 0.010 60)` con hue
  spostata verso il caldo per non stonare con l'accento terracotta.

I nomi dei token (`--brand-navy`, `--brand-gold`) **vengono mantenuti** come
alias storici per minimizzare l'impatto sul codice esistente. Documentato
esplicitamente in `src/styles.css` che `--brand-navy` veicola inchiostro e
`--brand-gold` veicola terracotta.

Il **logo** sul tema scuro diventa **adattivo**: tile panna + glifo
inchiostro + accento terracotta (variante B). Nuovi token `--logo-tile`,
`--logo-glyph`, `--logo-border`, `--logo-border-opacity`, `--logo-wordmark`
gestiscono il comportamento; il componente `<Logo>` con tone `"navy"` li
legge automaticamente. I tone `"inverse"` e `"mono"` restano per casi
forzati (fondi scuri brandizzati arbitrari, stampa monocromatica).

## Conseguenze

**Positive**

- Differenziazione netta da Fineco e dalle banche commerciali italiane.
- Posizionamento visivo chiaro: editoriale/legale, non fintech.
- Sfondo dark più armonioso con l'accento caldo (hue 60 invece di 250).
- Logo più leggibile sul dark (tile chiaro su fondo scuro).

**Negative / costi**

- I nomi token `--brand-navy/gold` non corrispondono più semanticamente al
  loro valore. Mitigato con commenti espliciti nel CSS e in `BRAND.md`.
  Una rinominazione futura a `--brand-ink/terracotta` resta possibile ma
  non urgente.
- L'og-image `/og-image.jpg` va rigenerata (fatto contestualmente).
- Tutti i materiali esterni già pubblicati con la vecchia palette
  diventano obsoleti (per ora nessuno: il prodotto non è ancora pubblicato).

## Riferimenti

- `src/styles.css` — token aggiornati
- `src/components/brand/logo.tsx` — logo adattivo
- `BRAND.md`, `mem://design/brand` — documentazione brand allineata
