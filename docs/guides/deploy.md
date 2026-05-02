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
4. Apri una PR verso `main`: GitHub esegue il workflow `Quality`.
5. Vercel crea un deployment di preview dal branch.
6. Quando Quality e preview sono verificati, fai merge su `main`.
7. Vercel pubblica la produzione dal branch `main`.

Il workflow GitHub è volutamente leggero: `npm ci`, `npm run build`, lint solo
sui file sorgente modificati e `npm audit --audit-level=moderate` solo quando
cambiano `package.json` o `package-lock.json`. L'avvio manuale esegue sempre
anche l'audit.

Il repo resta privato e nel percorso gratuito: non basare il processo su branch
protection a pagamento. La protezione reale è la disciplina di PR + Quality +
preview Vercel.

## Variabili d'ambiente

Configurare in Vercel Project Settings → Environment Variables:

- `VITE_SUPABASE_URL` — client e server, Production e Preview.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — client e server, Production e Preview.
- `VITE_SUPABASE_PROJECT_ID` — client e server, Production e Preview.
- `SUPABASE_URL` — server, Production e Preview.
- `SUPABASE_PUBLISHABLE_KEY` — server, Production e Preview.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, Production e Preview solo se serve.

`SUPABASE_SERVICE_ROLE_KEY` è server-only: non va mai esposta al client.

Per ora Pratix usa un solo progetto Supabase anche per le preview Vercel. Di
conseguenza le preview servono a verificare build, routing e UI; non sono un
ambiente per test distruttivi sui dati. Un secondo Supabase free può essere
valutato solo se resta davvero dentro i limiti gratuiti disponibili.

In GitHub Secrets non serve duplicare le variabili Vercel. Inserisci solo
segreti necessari a workflow CI specifici. Il workflow `Quality` attuale non
richiede segreti.

## Supabase Auth

Nel progetto Supabase:

- Site URL: `https://pratix.vercel.app/`
- Redirect URL principali:
  - `https://pratix.vercel.app/dashboard`
  - `https://pratix.vercel.app/reimposta-password`

Le preview Vercel possono essere aggiunte come redirect separati quando serve
testare flussi auth su branch.

Se la Deployment Protection Vercel è attiva sulle preview, evita fetch assoluti
verso URL generati e preferisci path relativi nelle chiamate interne.

## Preview Vercel

Nel piano Hobby usa Vercel Authentication con protezione standard per le
preview e gli URL di deployment. La produzione su `https://pratix.vercel.app`
resta pubblica.

Verifiche minime su ogni preview:

- login e logout;
- navigazione nelle route principali;
- recupero password solo se la redirect URL è configurata in Supabase;
- nessun errore evidente nei log Vercel;
- nessun test distruttivo sul database condiviso.

## Dominio

Il dominio gratuito ufficiale è `https://pratix.vercel.app`.

Un dominio custom su Vercel resta opzionale. Il custom domain Supabase non è
necessario per Pratix e non fa parte del percorso gratuito attuale.

## Sicurezza prima di pubblicare

Checklist minima:

- [ ] PR verso `main` aperta e workflow `Quality` completato
- [ ] Preview Vercel verificata
- [ ] `npm run build` ok
- [ ] `npm run lint` ok oppure issue note e non correlate alla modifica
- [ ] `npm audit --audit-level=moderate` ok se sono cambiate dipendenze
- [ ] Supabase advisors verificati quando cambiano schema, RLS o auth
- [ ] Recupero password attivo
- [ ] Pagine Privacy e Termini presenti
- [ ] Meta tag e og:image sulle pagine pubbliche
- [ ] Errori auth generici (no enumeration)

Vedi [SECURITY.md](../../SECURITY.md) e [ROADMAP.md](../../ROADMAP.md) per lo stato.
