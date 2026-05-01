# Guida — Deploy e pubblicazione

> Questa guida descrive lo stato storico Lovable. Il target aggiornato è
> l'uscita completa da Lovable con pubblicazione tramite DuckDNS: vedi
> [`uscita-lovable.md`](./uscita-lovable.md).

## Modello

Pratix è ospitato su **Lovable**, runtime Cloudflare Worker (con `nodejs_compat`). Il backend (Lovable Cloud / Supabase) è già attivo.

## Frontend vs Backend

- **Frontend** (UI, client): le modifiche vanno in produzione **solo dopo aver cliccato "Update"** nel publish dialog.
- **Backend** (edge functions, migrazioni database): si deployano **immediatamente e automaticamente** al salvataggio.

## Pubblicare

1. Apri il **publish dialog** (in alto a destra su desktop, in basso a destra in Preview su mobile).
2. Verifica le modifiche pendenti.
3. Clicca **Update** (o **Publish** alla prima volta).
4. Riceverai un URL `pratix.lovable.app` (o simile).

> Una volta pubblicato puoi connettere o acquistare un dominio custom (vedi sotto).

## Visibilità

- **Public**: chiunque con il link vede il sito.
- **Private**: solo membri del workspace (richiede piano Business o Enterprise).

Da gestire in Project Settings → Publishing.

## Dominio custom

### Acquistare in Lovable
- Project Settings → Domains → **Buy new domain** (richiede piano a pagamento).
- Una volta comprato, è connesso automaticamente. La gestione DNS avviene da `⋯ → Configure → Manage DNS records`.

### Connettere un dominio esterno
1. Project Settings → Domains → **Connect Domain**.
2. Inserisci il dominio (es. `pratix.app`).
3. Configura presso il tuo registrar:
   - **A record** `@` → `185.158.133.1`
   - **A record** `www` → `185.158.133.1`
   - **TXT record** `_lovable` con il valore `lovable_verify=...` mostrato
4. Attendi propagazione DNS (fino a 72h).
5. SSL provisioning automatico.

Aggiungere **sia** il dominio root **sia** `www`, scegliere uno come primario.

### Cloudflare / proxy
Se usi Cloudflare in modalità proxy: nel dialog "Connect Domain" espandi **Advanced** e attiva *"Domain uses Cloudflare or a similar proxy"* per usare la verifica via CNAME.

## Stati del dominio

| Stato | Significato |
|---|---|
| Unpublished | Subdomain `.lovable.app`, progetto non ancora pubblicato |
| Ready | DNS ok, da pubblicare |
| Action required | Setup interrotto, completalo |
| Verifying | In attesa di propagazione |
| Setting up | Verifica ok, SSL in corso |
| Active | Live |
| Offline | DNS rotto, ripristinalo |
| Failed | SSL fallito, retry |

## Variabili d'ambiente

Gestite automaticamente:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

I segreti privati vivono in **Lovable Cloud → Secrets**, mai nel codice né in `.env` (che è auto-gestito).

## Edge functions

- Vivono in `supabase/functions/<nome>/index.ts`.
- Deploy automatico al salvataggio.
- I log sono accessibili via tool di Lovable Cloud.
- `verify_jwt = false` solo dove esplicitamente richiesto (webhook pubblici verificati con firma).

## Webhook e cron pubblici

Routes pubbliche (no auth Lovable) sotto `src/routes/api/public/*`. **Verificare sempre** la firma o un token condiviso prima di processare.

URL stabili:
- `project--<id>.lovable.app` — produzione
- `project--<id>-dev.lovable.app` — preview

## Sicurezza prima di pubblicare

Checklist minima:

- [ ] `npm run build` ok
- [ ] `npm run lint` ok
- [ ] Scan di sicurezza Lovable senza issue critici
- [ ] Linter Supabase pulito (no RLS mancanti)
- [ ] Recupero password attivo
- [ ] Pagine Privacy e Termini presenti
- [ ] Meta tag e og:image sulle pagine pubbliche
- [ ] Errori auth generici (no enumeration)

Vedi [SECURITY.md](../../SECURITY.md) e [ROADMAP.md](../../ROADMAP.md) per lo stato.
