# Guida — Smoke accessibilità WebKit

## Scopo

`npm run smoke:a11y` esegue uno smoke ripetibile sulle superfici principali con
WebKit, `axe-core`, tema chiaro/scuro e viewport desktop, tablet e mobile.

Il controllo segnala:

- violazioni WCAG A/AA rilevate da axe;
- overflow orizzontale della pagina;
- controlli interattivi con testo tagliato in modo non intenzionale.

## Quando usarlo

Lo smoke WebKit/a11y è un gate di chiusura per modifiche UI sostanziali, flussi
autenticati critici, routing, componenti condivisi, release o publish. Non è un
automatismo per ogni diff.

Usa una verifica più leggera quando il rischio è limitato:

- nessuna modifica o sola analisi: nessun test applicativo;
- docs interne, roadmap, ADR, regole agenti o memoria: rilettura/coerenza ed
  eventualmente `npm run format:changed:check`;
- fix piccolo non UI: test mirato, con lint/build solo se il diff tocca codice
  TypeScript, routing, configurazione o contratti condivisi;
- microcopy o piccola UI locale: controllo mirato della pagina o del componente
  interessato, anche via browser leggero se serve.

Se una modifica sostanziale non può essere coperta dallo smoke completo,
dichiara esplicitamente cosa è stato verificato e quale rischio resta.

## Esecuzione pubblica locale

```bash
npm run smoke:a11y
```

Il comando avvia il dev server su `127.0.0.1:3300`, disattiva Turnstile in
locale e controlla le route pubbliche. Se la variabile
`SUPABASE_SERVICE_ROLE_KEY` è già disponibile nella shell, include anche le
route autenticate:

- `/`
- `/login`
- `/register`
- `/recupera-password`
- `/privacy`
- `/termini`

## Esecuzione autenticata

Per includere sempre le route autenticate, usa il comando dedicato:

```bash
npm run smoke:a11y:auth
```

Il comando recupera la service role key tramite Supabase CLI, la passa solo in
memoria allo smoke e non la stampa né la salva su disco. Lo script usa l'account
test Pratix predefinito, genera un magic link server-side e lo usa solo dentro
WebKit: non richiede password e non legge la casella email.

Il comando aggiunge dashboard, anagrafiche, pratiche, attività, fatture,
novità, account, impostazioni, Controllo duplicati e Creazione guidata.
Sul terminale stampa una riga `[smoke:a11y] audit ...` per ogni combinazione
route/tema/viewport: il giro autenticato completo è più lungo di quello
pubblico e può richiedere alcuni minuti.

Prerequisiti:

- Supabase CLI autenticato sulla macchina locale;
- `VITE_SUPABASE_PROJECT_ID` oppure `SUPABASE_URL`/`VITE_SUPABASE_URL`
  disponibile nei file env locali;
- account test presente in `profiles`.

Per usare una casella diversa da quella test predefinita, esporta
`PRATIX_SMOKE_EMAIL`. Le password non sono supportate: non usare
`PRATIX_SMOKE_PASSWORD` né il vecchio item Portachiavi
`pratix-codex-test-account`.

Se vuoi fornire manualmente la service role da un provider sicuro, puoi ancora
eseguire:

```bash
SUPABASE_SERVICE_ROLE_KEY="<service-role-key-da-provider-sicuro>" \
node scripts/smoke-a11y.mjs --start-server --auth-required
```

## Esecuzione su produzione pubblica

```bash
PRATIX_SMOKE_BASE_URL="https://pratix.vercel.app" \
node scripts/smoke-a11y.mjs --public-only
```

Usala dopo il deploy quando serve una verifica leggera delle pagine pubbliche.

## Note operative

Se WebKit non è presente nella macchina locale, installalo con:

```bash
npx playwright install webkit
```

Per cambiare porta locale:

```bash
PRATIX_SMOKE_PORT=3400 npm run smoke:a11y
```

Se lo smoke sembra fermo, guarda l'ultima riga `[smoke:a11y] audit ...`: indica
la route, il tema e il viewport in corso. Ogni audit axe ha un timeout
predefinito di 20 secondi, modificabile solo per diagnosi con:

```bash
PRATIX_SMOKE_AUDIT_TIMEOUT_MS=30000 npm run smoke:a11y:auth
```

Il valore è espresso in millisecondi e deve essere un numero intero positivo:
usa `30000`, non formati testuali come `30s`.

Se il timeout scatta su una route specifica, tratta la route come regressione o
come problema del test harness da diagnosticare. Non chiudere il lavoro dicendo
solo che lo smoke "si è bloccato": riporta l'ultima route stampata e il comando
eseguito.
