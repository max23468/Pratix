# Branding Pratix — Identità completa

## 1. Posizionamento e personalità

**Pratix** è il gestionale per avvocati freelance italiani che vogliono uno strumento moderno, ordinato e affidabile, senza l'austerità degli applicativi legali tradizionali e senza la freddezza dei SaaS generici.

- **Personalità**: professionale moderno — fiducioso, contemporaneo, ordinato.
- **Promessa**: "Tutto sotto controllo, niente fronzoli."
- **Riferimenti visivi**: Linear, Notion, Stripe, ma con un tocco di gravitas legale (navy + oro).

## 2. Sistema cromatico

Tutti i token in `oklch` su `src/styles.css`, con varianti light e dark.

**Primario — Navy inchiostro**
- `--primary` ≈ `oklch(0.30 0.07 255)` (≈ #1F2D4D)
- `--primary-foreground` bianco caldo
- `--primary-hover` leggermente più chiaro

**Accento — Oro brunito**
- `--accent` ≈ `oklch(0.68 0.11 75)` (≈ #B8893C)
- usato per: CTA secondarie, KPI rilevanti, focus ring, badge "premium", micro-dettagli logo

**Neutri caldi (off-white invece di bianco puro)**
- `--background` ≈ `oklch(0.985 0.003 80)` (panna leggerissima)
- `--card` bianco con tinta crema impercettibile
- `--muted` / `--muted-foreground` grigi caldi
- `--border` grigio caldo, basso contrasto

**Stati semantici** (calibrati per coesistere con navy + oro)
- `--success` verde bosco desaturato
- `--warning` ambra (distinto dall'accento oro)
- `--destructive` rosso mattone, non puro
- `--info` blu cielo desaturato

**Dark mode**: navy diventa il background, accento oro mantiene la stessa hue ma più luminoso. Non un semplice "invert".

**Gradients e shadows** (token dedicati)
- `--gradient-hero`: navy → navy più scuro (per landing/hero)
- `--gradient-accent`: oro → oro caldo (per badge premium)
- `--shadow-elegant`: ombra navy con bassa opacità per card elevate
- `--shadow-soft`: ombra neutra per UI quotidiana

## 3. Tipografia

**Display** — Inter Display (titoli, hero, KPI grandi)
**UI/Body** — Inter (tutto il resto)
**Mono** — JetBrains Mono (numeri fattura, importi tabellari, codici)

Caricamento via Google Fonts nel `__root.tsx` con `display=swap`. Inter Display è ottimizzato per dimensioni grandi (≥24px), Inter per il resto.

**Scala tipografica** (token in `styles.css`)
- Display XL: 48-64px, tracking stretto, weight 600 (hero landing)
- Display L: 32-40px, weight 600 (titoli pagina importanti)
- H1: 24-28px, weight 600
- H2: 20px, weight 600
- H3: 16-18px, weight 600
- Body: 14-15px, weight 400
- Small: 13px, weight 400-500
- Mono importi: tabular-nums attivo

**Regole d'uso**
- Numeri (importi, KPI, date) sempre con `font-variant-numeric: tabular-nums`
- Tracking leggermente negativo sui display (-0.02em)
- Mai usare weight 700+ per i titoli display (resta elegante)

## 4. Logo

Sviluppo **3 direzioni** come SVG inline (componente `<Logo />` con varianti `mark`, `wordmark`, `lockup`):

**A. Monogramma "Px" geometrico**
- Lettere costruite su una griglia, con la "x" che taglia la "P" creando una piccola lega/serif d'oro.
- Funziona come favicon, app icon e accanto al wordmark.

**B. Monogramma "P" con barra orizzontale**
- "P" sans con una barra orizzontale dorata che richiama la riga di un documento/atto.
- Più sobrio, molto scalabile.

**C. Sigillo circolare**
- Cerchio navy con "P" centrata, piccolo dettaglio oro a richiamo della ceralacca/sigillo.
- Più "istituzionale", buono per documenti PDF generati (intestazione fattura).

**Wordmark**: "Pratix" in Inter Display 600, tracking -0.03em, eventuale dettaglio oro su un glifo (es. punto sulla "i" o taglio sulla "x").

**Implementazione**
- Componente `src/components/brand/logo.tsx` con prop `variant` (`mark` | `wordmark` | `lockup`) e `tone` (`navy` | `mono` | `inverse`).
- Favicon SVG + PNG fallback in `public/`.
- Apple touch icon, OG image template.

Tutte e 3 le direzioni vengono prodotte; l'utente sceglie dalla preview e si imposta come default.

## 5. Iconografia e illustrazione

- **Icone**: Lucide React (già in uso), stroke 1.5, mai colorate — solo `currentColor`.
- **Illustrazioni**: nessuna illustrazione character-based. Si usano composizioni geometriche (linee, rettangoli, circles) navy + oro per stati vuoti e onboarding.
- **Empty states**: piccola composizione geometrica + frase breve + CTA.

## 6. Tono di voce — Tu professionale, neutro

**Principi**
- "Tu", mai "Lei". Mai "Vi".
- Frasi brevi, verbi all'indicativo o imperativo gentile.
- Niente emoji nella UI di prodotto. Niente esclamativi multipli.
- Numeri sempre con separatore migliaia italiano e simbolo €.
- Date in formato italiano esteso o breve coerente (es. `12 mag 2026` o `12/05/2026`).

**Esempi di micro-copy**
- Login: "Accedi" / "Email" / "Password" / "Hai dimenticato la password?"
- Empty state pratiche: "Nessuna pratica ancora. Apri la prima per iniziare."
- Conferma azione distruttiva: "Eliminare questa pratica? L'azione non può essere annullata."
- Toast successo: "Fattura emessa." (non "Fattura emessa con successo!")
- Errore: "Non è stato possibile salvare. Riprova." (non "Oops!")
- Loading: "Caricamento…" (non "Sto caricando i tuoi dati…")

**Glossario operativo** (file `BRAND.md` con i termini canonici)
- Pratica (non "Caso", non "Fascicolo")
- Cliente (non "Assistito" nella UI, anche se tecnicamente corretto)
- Fattura, Fattura elettronica, XML SdI
- Scadenza (non "Deadline")
- Spese (non "Costi")
- Bozza, Emessa, Pagata, Scaduta, Annullata

## 7. Componenti UI da rivedere

Mantengo l'architettura shadcn esistente. Aggiorno varianti e token, niente refactor strutturali.

- **Button**: varianti `default` (navy), `accent` (oro), `outline`, `ghost`, `destructive`. Hover/focus con focus-ring oro.
- **Badge**: varianti per stati pratiche e fatture, palette ricalibrata (es. "Pagata" verde bosco, "Scaduta" rosso mattone, "Bozza" neutro).
- **Card**: bordo ultra-sottile, shadow-soft, padding coerente.
- **Input/Select**: focus ring oro brunito su navy, niente blu di sistema.
- **Sidebar**: tinta navy molto scura in dark, off-white in light. Logo coerente con stato `collapsed`.
- **Tabelle**: zebra leggerissima, header weight 500, importi mono allineati a destra.
- **Toaster (sonner)**: già `richColors`, ricalibrato sui token nuovi.

## 8. Pagine "vetrina" da allineare

Aggiornamento estetico (non strutturale) delle pagine già esistenti:

- **Landing `/`**: hero con Display XL, accento oro su una parola chiave, feature grid ricomposta con nuove icone e palette.
- **Login / Register**: card centrata su background panna, logo `lockup` in alto.
- **Dashboard**: KPI con numeri Inter Display + tabular-nums, accenti oro sui valori chiave.
- **Fattura PDF**: intestazione con logo (variante `sigillo` o `lockup`), navy + oro sui totali, layout già esistente solo restylizzato.

## 9. Asset di brand

- **Favicon**: SVG + 32/180 PNG.
- **OG image**: template 1200×630 con logo, claim, gradiente navy.
- **Email auth** (futuro): predispongo i token CSS per i template, non scaffold ora.
- **`BRAND.md`** in root: palette, scala tipografica, regole logo, glossario, do/don't di tono.

## 10. Dettagli tecnici

- Tutti i colori in `src/styles.css` come variabili CSS (oklch), light + dark.
- Nessun colore hardcoded nei componenti — solo classi Tailwind che puntano ai token.
- Font caricati via `<link>` in `__root.tsx` con preconnect a Google Fonts.
- `tabular-nums` applicato globalmente su `<td>` numerici e classi `.num`.
- Componente `<Logo />` riutilizzabile, niente SVG sparsi nel codice.
- Aggiornamento `index.html` (se presente) o head root con favicon, theme-color (navy), apple-touch-icon.

## 11. Cosa NON è in questo piano

- Refactor architetturale di routing o feature.
- Nuove funzionalità di prodotto.
- Animazioni complesse (framer-motion): solo transizioni CSS sobrie. Si può aggiungere in un passo successivo se vuoi un layer di motion design.
- Sistema completo di marketing (sito multi-pagina, blog, ecc.). La landing attuale viene allineata, non riscritta.

## 12. Output finale

Al termine avrai:
- Design system aggiornato (token, font, ombre, gradient).
- Componente `<Logo />` con 3 varianti scelte tu.
- Tutte le pagine esistenti riallineate al nuovo brand.
- Favicon + OG image base.
- File `BRAND.md` come riferimento per copy e identità.

---

Confermi così, o vuoi modificare/aggiungere qualcosa (es. una direzione logo specifica, un dettaglio cromatico, includere fin da subito le animazioni)?
