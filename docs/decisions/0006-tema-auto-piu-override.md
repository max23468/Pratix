# ADR 0006 — Tema: auto + override manuale, dark mode rilassante

- **Stato**: Accettato
- **Data**: 2026-04-29

## Contesto

Pratix viene usato per ore consecutive su pratiche, scadenze, fatture. La leggibilità e il comfort visivo sono parte del prodotto, non un dettaglio estetico.

Decisioni da prendere:

1. **Strategia di selezione del tema**: solo light? auto da sistema? toggle manuale?
2. **Estetica della dark mode**: navy intenso (coerente col brand) o più neutro?

Prima iterazione: dark mode con `--background: oklch(0.16 0.04 260)` (navy profondo). Feedback diretto: **troppo blu, affaticante**.

## Decisione

### 1. Strategia tema

**Auto** (default, segue `prefers-color-scheme`) **+ override manuale** (light, dark).

- Provider in `src/lib/theme-context.tsx`.
- Toggle `<ThemeToggle>` in **sidebar** (UI autenticata), **landing** e **impostazioni**.
- Persistenza preferenza utente (localStorage) con no-flash script inline in `__root.tsx`.

### 2. Dark mode "rilassante"

Background dark spostato a `oklch(0.18 0.012 250)`: **grigio caldo neutro**, non navy.

- Croma molto bassa (0.012 anziché 0.04): meno saturazione = meno affaticamento.
- Hue 250 anziché 260: leggera spinta verso il neutro caldo.
- I token brand (`--color-brand-navy/cream/gold`) restano **fissi** in entrambi i temi: il logo non cambia.

## Conseguenze

- ✅ Comfort visivo prolungato in dark mode.
- ✅ Il brand resta riconoscibile anche con sfondi neutri (token brand fissi).
- ✅ L'utente può forzare il tema preferito senza dipendere dal sistema.
- ⚠️ Servirà un audit di **contrasto WCAG AA** su entrambi i temi (specie su `muted-foreground`, `success`, `warning`).
- ⚠️ Documentare la regola "token brand fissi" è cruciale per evitare regressioni di marca.
- 🔁 La saturazione sarà rivista se emergerà che il grigio risulta "spento": si potrà alzare `chroma` di pochissimo senza perdere il riposo visivo.

## Alternative considerate

- **Solo light mode**: semplice, ma cliente professionale che lavora in serata penalizzato.
- **Solo dark intensa, navy profondo**: coerente col brand ma faticosa (rifiutato dopo prova).
- **OLED nero puro**: stiloso ma sbagliato per un'app di lettura prolungata.
- **Solo auto, niente override**: rigido, alcuni utenti hanno preferenze opposte rispetto al sistema.

## Riferimenti

- [`docs/guides/tema-e-design.md`](../guides/tema-e-design.md)
- [`BRAND.md`](../../BRAND.md)
- `src/lib/theme-context.tsx`
- `src/styles.css`
