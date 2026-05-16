# Guida — Smoke accessibilità WebKit

## Scopo

`npm run smoke:a11y` esegue uno smoke ripetibile sulle superfici principali con
WebKit, `axe-core`, tema chiaro/scuro e viewport desktop, tablet e mobile.

Il controllo segnala:

- violazioni WCAG A/AA rilevate da axe;
- overflow orizzontale della pagina;
- controlli interattivi con testo tagliato in modo non intenzionale.

## Esecuzione pubblica locale

```bash
npm run smoke:a11y
```

Il comando avvia il dev server su `127.0.0.1:3300`, disattiva Turnstile in
locale e controlla le route pubbliche:

- `/`
- `/login`
- `/register`
- `/recupera-password`
- `/privacy`
- `/termini`

## Esecuzione autenticata

Per includere le route autenticate, rendi disponibile la service role key
Supabase nella shell. Lo script usa l'account test Pratix predefinito, genera un
magic link server-side e lo usa solo dentro WebKit: non richiede password, non
legge la casella email e non stampa il link in output. Non salvare la service
role key nel repo.

```bash
SUPABASE_SERVICE_ROLE_KEY="<service-role-key-da-provider-sicuro>" \
npm run smoke:a11y
```

Il comando aggiunge dashboard, anagrafiche, pratiche, attività, fatture,
novità, account, impostazioni e import archivio.

Lo smoke autenticato parte solo se sono disponibili `SUPABASE_SERVICE_ROLE_KEY`
e `SUPABASE_URL` oppure `VITE_SUPABASE_URL`. Per usare una casella diversa da
quella test predefinita, esporta anche `PRATIX_SMOKE_EMAIL`. Se una variabile
obbligatoria manca, il comando resta automaticamente sul perimetro pubblico.

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
