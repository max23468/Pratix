# Guida — Deploy e pubblicazione

## Modello

Pratix viene pubblicato su **Vercel** dal repository GitHub.

- **Codice**: GitHub (`https://github.com/max23468/Pratix.git`)
- **Hosting**: Vercel
- **Produzione**: `https://pratix.vercel.app`
- **Backend**: Supabase di proprietà del progetto

## Deploy

1. Lavora su branch dedicato.
2. Esegui le verifiche pertinenti in locale.
3. Push su GitHub.
4. Vercel crea un deployment dal branch.
5. Quando la preview è verificata, promuovi il deployment a production.

## Variabili d'ambiente

Configurare in Vercel Project Settings → Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` è server-only: non va mai esposta al client.

## Supabase Auth

Nel progetto Supabase:

- Site URL: `https://pratix.vercel.app/`
- Redirect URL principali:
  - `https://pratix.vercel.app/dashboard`
  - `https://pratix.vercel.app/reimposta-password`

Le preview Vercel possono essere aggiunte come redirect separati quando serve
testare flussi auth su branch.

## Dominio

Il dominio gratuito ufficiale è `https://pratix.vercel.app`.

Un dominio custom su Vercel resta opzionale. Il custom domain Supabase non è
necessario per Pratix e non fa parte del percorso gratuito attuale.

## Sicurezza prima di pubblicare

Checklist minima:

- [ ] `npm run build` ok
- [ ] `npm run lint` ok oppure issue note e non correlate alla modifica
- [ ] `npm audit --audit-level=moderate` ok se sono cambiate dipendenze
- [ ] Supabase advisors verificati quando cambiano schema, RLS o auth
- [ ] Recupero password attivo
- [ ] Pagine Privacy e Termini presenti
- [ ] Meta tag e og:image sulle pagine pubbliche
- [ ] Errori auth generici (no enumeration)

Vedi [SECURITY.md](../../SECURITY.md) e [ROADMAP.md](../../ROADMAP.md) per lo stato.
