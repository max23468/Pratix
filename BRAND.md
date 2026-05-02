# Pratix — Brand Guidelines

Identità visiva e linee guida operative per Pratix, gestionale per avvocati freelance italiani.

## 1. Posizionamento

- **Cosa è**: gestionale completo per avvocati che lavorano da soli (pratiche, scadenze, spese, fatturazione elettronica).
- **Personalità**: professionale moderno. Fiducioso, ordinato, contemporaneo. Niente austerità da software legale anni '90, niente leggerezza da SaaS generico.
- **Promessa**: "Tutto sotto controllo, niente fronzoli."
- **Pubblico**: avvocato/avvocata freelance, 28-55 anni, attento ai dettagli, alla forma e alla riservatezza.

## 1.bis Tagline

**Tagline ufficiale: _Tutto torna._**

Doppio senso intenzionale:
1. **Letterale, da gestionale** — "tornare" in contabilità significa quadrare. I conti tornano, le ritenute tornano, le scadenze tornano. Rassicurazione asciutta sull'esattezza.
2. **Emotivo** — "tutto torna" è la frase che si dice quando le cose, dopo la confusione, trovano un senso. Il sollievo del controllo.
3. **Chiusura del cerchio** — ogni pratica si apre e si chiude, ogni fattura si emette e si incassa, ogni scadenza si fissa e si rispetta. Pratix fa tornare ogni cerchio al suo punto.

**Uso**:
- Sempre con il punto fermo: `Tutto torna.`
- Mai tradurre. È intraducibile per costruzione: il valore è proprio nella polisemia italiana di "tornare".
- Si usa **da sola** in copertine, hero, OG image, social. **In coppia col nome prodotto** nei meta tag della home pubblica: `Pratix · Tutto torna.`
- Mai abbreviare in "Tt." o usare emoji. Mai esclamativo.

**Titoli pagina e meta tag**:
- Usa sempre `·` come separatore fra titolo pagina e brand: `Dashboard · Pratix`.
- Riserva `Pratix · Tutto torna.` alla home pubblica.
- Non usare `— Pratix` nei title, negli `og:title` o nelle preview social.

**Quando NON usarla**: dentro l'app autenticata (UI di lavoro), nei messaggi di errore, nei CTA. È un asset di marca, non microcopy.


## 2. Sistema cromatico

Tutti i token vivono in `src/styles.css` come variabili CSS in `oklch`, con varianti light e dark.

> **Nota nomi**: i token storici `--brand-navy` e `--brand-gold` sono mantenuti
> per compatibilità ma ora veicolano rispettivamente **inchiostro profondo** e
> **terracotta**. La scelta è documentata in [`docs/decisions/0007-palette-inchiostro-terracotta.md`](./docs/decisions/0007-palette-inchiostro-terracotta.md).

| Ruolo | Token | Light | Dark |
|---|---|---|---|
| Primario (Inchiostro) | `--primary` | `oklch(0.22 0.04 260)` | `oklch(0.94 0.006 80)` (chiaro su scuro) |
| Brand gold = **Terracotta** (accento) | `--brand-gold` | `oklch(0.62 0.15 35)` | `oklch(0.70 0.15 38)` |
| Sfondo | `--background` | panna `oklch(0.985 0.004 80)` | grigio caldo `oklch(0.18 0.010 60)` |
| Card | `--card` | bianco caldo | grigio caldo medio |
| Border | `--border` | `oklch(0.91 0.008 60)` | bianco 10% |
| Success | `--success` | verde bosco | verde bosco chiaro |
| Warning | `--warning` | ambra calda (≠ terracotta) | ambra chiaro |
| Destructive | `--destructive` | rosso mattone | rosso mattone vivido |
| Info | `--info` | blu desaturato | blu chiaro |

**Regole**:

- Mai usare colori hardcoded nei componenti. Sempre token (`bg-primary`, `text-brand-gold`, ecc.).
- La terracotta è un accento, non un primario. Usala per: CTA secondarie premium, KPI di valore (incassato, fatturato), focus ring, badge "premium", micro-dettagli del logo.
- Lo sfondo light è panna leggerissima, mai bianco puro. Lo sfondo dark è un grigio caldo neutro con hue 60 (calda) per armonizzare con la terracotta.
- In dark il primario diventa chiaro (la gerarchia si inverte) ma il senso resta: testo principale alto contrasto, terracotta come accento.

**Token logo adattivi** (gestiscono la variante chiara/scura del marchio):
`--logo-tile`, `--logo-glyph`, `--logo-border`, `--logo-border-opacity`,
`--logo-wordmark`. Cambiano automaticamente fra light e dark in modo che il
logo resti leggibile (tile inchiostro su panna in light, tile panna su scuro
in dark).

**Gradients**: `--gradient-hero` (inchiostro→inchiostro più profondo), `--gradient-accent` (terracotta→terracotta calda).
**Shadows**: `--shadow-soft`, `--shadow-elevated`, `--shadow-elegant` (inchiostro), `--shadow-gold` (terracotta).

## 3. Tipografia

| Ruolo | Font | Uso |
|---|---|---|
| Display | **Inter Tight** (600) | Titoli, hero, KPI, page header. `font-display` |
| UI / Body | **Inter** (400/500/600) | Tutto il resto. `font-sans` (default) |
| Mono | **JetBrains Mono** | Numeri fattura grandi, codici, importi tabellari. `font-mono` |

Caricati via Google Fonts in `src/routes/__root.tsx`.

**Regole**:

- Tracking dei display: `-0.02em` (gestito automaticamente da `h1/h2/h3` e `.font-display`).
- Mai weight ≥700 sui display: resta 600 per eleganza.
- Numeri (importi, KPI, date in tabella) sempre con `tabular-nums`. Già attivo su `.num`, `.tabular`, `td.text-right` e `.font-mono`.
- Importi in elenchi: allineati a destra.

**Scala suggerita**:

- Display XL (hero landing): `text-5xl`/`text-6xl` font-display 600
- Page header: `text-[26px]` font-display 600
- Card title: `text-base` font-display 600
- Body: `text-sm` (14px) o `text-[15px]`
- Small: `text-xs` (12px) muted

## 4. Logo

Componente: `src/components/brand/logo.tsx` → `<Logo />`.

**Direzioni** disponibili (prop `direction`):

- `px` (default): monogramma "Px" geometrico con trattino oro che taglia la P.
- `bar`: "P" sans con barra orizzontale dorata sotto.
- `seal`: sigillo circolare con ceralacca dorata. Adatto a documenti PDF.

**Forme** (prop `form`):

- `lockup` (default): simbolo + wordmark.
- `mark`: solo simbolo (favicon, sidebar collassata, app icon).
- `wordmark`: solo "Pratix".

**Toni** (prop `tone`):

- `navy` (default): **adattivo al tema**. In light = tile inchiostro + glifo panna + dettaglio terracotta. In dark = tile panna + glifo inchiostro + dettaglio terracotta. Funziona ovunque senza pensarci.
- `inverse`: forza tile panna (utile su fondi scuri brandizzati arbitrari, es. immagini).
- `mono`: monocromatico in `currentColor` (stampa, watermark).

**Esempi**:

```tsx
<Logo />                              // lockup adattivo 28px
<Logo form="mark" size={40} />        // solo simbolo
<Logo form="wordmark" tone="inverse" />
<Logo direction="seal" form="lockup" /> // per intestazione fattura PDF
```

**Per cambiare la direzione di brand a livello globale**: modifica `BRAND_DIRECTION` in `src/components/brand/logo.tsx`.

**Spazio di rispetto**: gestito dal componente (gap proporzionale alla size). Non incollare il logo a bordi o testo.

## 5. Iconografia

- Set: **Lucide React** (`lucide-react`), già installato.
- Stroke: `1.5`-`1.6` per rendering elegante (default Lucide è 2, troppo pesante per il brand).
- Mai colorate: solo `currentColor`. Il colore lo dà il container.
- Dimensioni: `h-4 w-4` in inline UI, `h-5 w-5` in card/StatCard, `h-6 w-6` in stati vuoti.

## 6. Componenti

- **Button**: varianti `default` (navy), `gold` (oro brunito, premium CTA), `outline`, `secondary`, `ghost`, `destructive`, `link`. Focus ring oro su tutto.
- **Badge**: stato pratica/fattura via `invoiceStatusVariant` / `caseStatusVariant`. Mai inventare classi colore inline.
- **Card**: `border-border/70 shadow-soft` come default; `shadow-elevated` per moduli importanti.
- **Sidebar**: usa `<Logo />` (lockup espanso, mark collassato).
- **Tabelle**: header weight 500, importi a destra con tabular-nums, zebra leggera.
- **Toaster (sonner)**: `richColors`, posizione top-right.

## 7. Tono di voce — Tu professionale, neutro

**Principi**:

1. Sempre **"tu"**, mai "Lei", mai "Voi".
2. Frasi brevi, verbi all'indicativo o imperativo gentile.
3. Niente emoji nella UI di prodotto.
4. Niente esclamativi multipli. Massimo uno, e solo se davvero serve.
5. Niente "Oops", "Ehi", "Wow", "Hai fatto centro!". Niente vezzeggiativi.
6. Numeri: separatore migliaia italiano, simbolo `€`. Date: formato breve coerente (`12 mag 2026` o `12/05/2026`).
7. Non rivolgersi all'utente al passato narrativo ("Hai creato la fattura"): preferire stato del sistema ("Fattura emessa.").

**Micro-copy canonico**:

| Contesto | Sì | No |
|---|---|---|
| Login | "Accedi" | "Entra subito!" |
| Login sub | "Inserisci le tue credenziali per continuare." | "Bentornato!" |
| Empty pratiche | "Nessuna pratica ancora. Apri la prima per iniziare." | "Non hai pratiche! Creane una 🎉" |
| Conferma elimina | "Eliminare questa pratica? L'azione non può essere annullata." | "Sicuro sicuro?" |
| Toast successo | "Fattura emessa." | "Fattura emessa con successo! ✅" |
| Errore | "Non è stato possibile salvare. Riprova." | "Oops! Qualcosa è andato storto" |
| Loading | "Caricamento…" | "Sto caricando i tuoi dati..." |
| CTA hero | "Crea il tuo account" | "Iniziamo insieme!" |

## 8. Glossario

Termini canonici nella UI e nei testi user-facing. Mantenerli costanti.

| Usa | Non usare |
|---|---|
| Pratica | Caso, Fascicolo, Dossier |
| Cliente | Assistito (anche se tecnicamente corretto in ambito legale) |
| Controparte | Resistente, Convenuto (riserva ai campi tecnici) |
| Scadenza | Deadline, Termine |
| Spese | Costi, Outlays |
| Fattura | Documento, Parcella |
| Fattura elettronica / XML SdI | E-invoice, Fattura PA |
| Bozza · Emessa · Pagata · Scaduta · Annullata | Draft, Issued, Paid, Overdue, Voided |
| Cassa Forense | Cassa previdenziale |
| Ritenuta d'acconto | RA, Ritenuta fiscale |
| Bollo | Marca da bollo (riserva al testo lungo) |
| Numerazione fattura | Series, Sequence |

## 9. Asset

- `public/favicon.svg`: favicon SVG navy + oro (variante `px`).
- Logo: solo come componente React. Non duplicare SVG nei vari file.
- OG image: per ora il browser usa l'estratto della pagina. Quando serve, generare 1200×630 con gradient hero + lockup oro + claim.

## 10. Cosa NON fare

- Non introdurre nuove librerie UI: shadcn/Radix è sufficiente.
- Non usare gradient sgargianti o glassmorphism: il brand è sobrio.
- Non scrivere colori hex direttamente nei componenti.
- Non creare logo SVG ad-hoc: usa `<Logo />`.
- Non variare il tono di voce per "essere più amichevoli": la fiducia si costruisce con la chiarezza, non con la simpatia forzata.
- Non aggiungere emoji, anche nei toast e nei messaggi di errore.
