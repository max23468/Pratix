# Guida — Tema e design system

## Filosofia

**Professionale moderno**, asciutto. Mai brutalismo, mai neon, mai gradient psichedelici. Coerenza con un prodotto che gestisce dati fiscali e legali: **fiducia + leggerezza**.

Per il dettaglio di marca completo vedi [`BRAND.md`](../../BRAND.md).

## Token semantici (regola d'oro)

> **Mai colori inline nei componenti.** Sempre token da `src/styles.css`.

I componenti usano classi semantiche (`bg-background`, `text-foreground`, `border-border`, `bg-primary text-primary-foreground`…). Il tema cambia rimpiazzando i token, non i componenti.

### Token dinamici (cambiano con light/dark)

```
--background, --foreground
--card, --card-foreground
--popover, --popover-foreground
--primary, --primary-foreground
--secondary, --secondary-foreground
--muted, --muted-foreground
--accent, --accent-foreground
--destructive, --success, --warning, --info (+ -foreground)
--border, --input, --ring
--sidebar*, --chart-*
```

### Token brand semantici

```
--color-brand-navy   = oklch(0.30 0.07 255)
--color-brand-cream  = oklch(0.985 0.004 80)
--color-brand-gold   = oklch(0.55 0.15 35)
```

Da usare tramite classi Tailwind (`text-brand-gold`, `bg-brand-gold`) e non come
valori hardcoded nei componenti.

## Palette (sorgente di verità)

| Ruolo          | Light                             | Dark                                    |
| -------------- | --------------------------------- | --------------------------------------- |
| Sfondo         | panna `oklch(0.985 0.004 80)`     | grigio caldo `oklch(0.18 0.010 60)`     |
| Testo          | inchiostro                        | panna                                   |
| Primario brand | inchiostro `oklch(0.22 0.04 260)` | panna `oklch(0.94 0.006 80)`            |
| Accento        | terracotta `oklch(0.55 0.15 35)`  | terracotta chiara `oklch(0.70 0.15 38)` |

La **dark mode è ammorbidita** (grigio caldo, croma bassa): scelta esplicita per
ridurre l'affaticamento visivo. Vedi [ADR 0006](../decisions/0006-tema-auto-piu-override.md)
e [ADR 0007](../decisions/0007-palette-inchiostro-terracotta.md).

## Tipografia

| Scala                 | Font                             | Uso                      |
| --------------------- | -------------------------------- | ------------------------ |
| `.font-display`       | **Inter Tight** (max weight 600) | h1, h2, h3, hero         |
| body                  | **Inter**                        | UI generale              |
| `.font-mono` / numeri | **JetBrains Mono**               | numeri tabellari, codici |

I numeri usano sempre `tabular-nums`: cifre di larghezza fissa per allineamento in colonne (fatture, importi, totali).

## Tema chiaro / scuro

Provider in `src/lib/theme-context.tsx` con tre stati:

- `auto` — segue `prefers-color-scheme` del sistema (default)
- `light` — forzato chiaro
- `dark` — forzato scuro

`<ThemeToggle>` mostra il toggle (sidebar, landing, impostazioni). Il **no-flash script** inline in `__root.tsx` previene il flash di tema sbagliato al primo render leggendo la preferenza salvata prima dell'idratazione.

## Logo

Una sola fonte: `src/components/brand/logo.tsx`. Usa sempre `<Logo>`.

- Direzione default `px` (orizzontale)
- **Mai SVG inline** in altri componenti
- Favicon `/favicon.svg`
- Usa i token brand fissi, quindi resta identico in light e dark

## Spaziature, raggi, ombre

Sistema Tailwind v4 standard. Raggi mediamente generosi (`rounded-lg`, `rounded-xl`) per il tono "moderno asciutto", senza esagerare.

## Componenti

Base: **shadcn/ui** in `src/components/ui/`. Modificare con cautela: sono primitive condivise.

Per varianti custom usare `cva` (class-variance-authority) — vedi i pattern già presenti (es. `button.tsx`).

## Accessibilità

- Tutti i contrasti devono passare WCAG AA in entrambi i temi.
- Focus visibile su ogni elemento interattivo.
- Rispetto di `prefers-reduced-motion`.
- `lang="it"` sul root.
- Per smoke ripetibili su WebKit, tema chiaro/scuro e viewport
  desktop/tablet/mobile usa [`smoke-a11y.md`](./smoke-a11y.md).

## Cosa NON fare

- ❌ Hex inline (`bg-[#3B82F6]`, `style={{ color: "#fff" }}`)
- ❌ Colori Tailwind generici (`bg-blue-500`, `text-white`)
- ❌ SVG del logo copiato e incollato
- ❌ Font diversi da quelli sopra
- ❌ Gradient drammatici, ombre eccessive
