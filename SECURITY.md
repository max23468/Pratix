# Politica di sicurezza

> Il repository è attualmente **privato**. Questo documento è predisposto per quando diventerà pubblico.

## Versioni supportate

Pratix è in sviluppo attivo. Solo l'ultima versione rilasciata riceve fix di sicurezza.

## Segnalare una vulnerabilità

Se scopri una vulnerabilità in Pratix:

1. **Non aprire una issue pubblica.**
2. Scrivi in privato al manutentore con:
   - una descrizione del problema,
   - i passi per riprodurlo,
   - l'impatto stimato,
   - eventuale proof-of-concept.
3. Riceverai conferma di lettura entro pochi giorni.
4. Concorderemo una finestra di disclosure responsabile prima di rendere pubblico il dettaglio.

## Ambito

Sono in scope:

- Esposizione di dati personali o di clienti (P.IVA, anagrafica, fatture).
- Bypass di autenticazione o di Row-Level Security su tabelle utente.
- Iniezione SQL, XSS, CSRF, SSRF.
- Vulnerabilità nelle dipendenze npm a impatto reale sull'app.
- Errori che permettano enumerazione utenti (es. messaggi auth grezzi).

Sono fuori scope:

- Vulnerabilità in servizi terzi (Supabase, Vercel, provider DNS): segnalarle ai rispettivi vendor.
- Attacchi di forza bruta non mitigabili a livello applicativo.
- Bug di UI senza impatto sui dati.

## Pratiche di sicurezza adottate

- Row-Level Security obbligatoria su tutte le tabelle con dati utente.
- Ruoli mai memorizzati su `profiles`: tabella `user_roles` separata.
- Nessun secret in repo: tutte le chiavi sensibili vivono in Vercel/Supabase.
- Messaggi di errore di autenticazione generici (no user enumeration).
- `npm audit --audit-level=moderate` periodico.
- Scan di sicurezza Supabase eseguiti regolarmente.

Vedi anche [`docs/guides/database.md`](./docs/guides/database.md) per il dettaglio sulle policy RLS.
