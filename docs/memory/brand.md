# Brand Pratix — sintesi rapida

Mirror leggibile della memoria `mem://design/brand`. Per il riferimento operativo completo vedi [`BRAND.md`](../../BRAND.md) in root.

Punti chiave non negoziabili:

- **Inchiostro `oklch(0.22 0.04 260)`** primario, **terracotta `oklch(0.62 0.15 35)`** accento (vibe editoriale legale italiano, NON fintech). Decisione registrata in [ADR-0007](../decisions/0007-palette-inchiostro-terracotta.md): differenziazione da Fineco e dal territorio bancario.
- Sfondo light panna `oklch(0.985 0.004 80)`, mai bianco puro. Sfondo dark grigio caldo `oklch(0.18 0.010 60)` (hue calda per armonizzare con terracotta).
- I token `--brand-navy` e `--brand-gold` sono mantenuti come alias storici ma ora veicolano rispettivamente inchiostro e terracotta. Documentato in `src/styles.css` e `BRAND.md`.
- Display: Inter Tight 600, mai >600. Body: Inter. Mono: JetBrains Mono. Tutti via Google Fonts in `__root.tsx`.
- Componente `<Logo>` (direction px/bar/seal · form mark/wordmark/lockup · tone navy/inverse/mono). Mai SVG inline. Tone `navy` è **adattivo**: tile inchiostro/glifo panna in light, tile panna/glifo inchiostro in dark, gestito dai token `--logo-tile`, `--logo-glyph`, `--logo-border`, `--logo-border-opacity`, `--logo-wordmark`.
- Button: variante `gold` per CTA premium (terracotta), `default` per primarie inchiostro.
- Tono: tu professionale neutro, niente emoji, niente esclamativi, glossario fisso (Pratica/Cliente/Scadenza/Spese/Fattura).
- Tabular-nums automatico su `.num`, `.tabular`, `.font-mono`, `td.text-right`.
