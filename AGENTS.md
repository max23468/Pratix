# AGENTS.md

## Aspettative Sul Repository

- Questa e' un'app React TanStack Start/Vite generata con Lovable.
- Usa `npm` per installare le dipendenze perche' il repository include `package-lock.json`.
- Non duplicare manualmente in `vite.config.ts` i plugin gia' forniti da `@lovable.dev/vite-tanstack-config`.
- Mantieni le modifiche focalizzate ed evita cambi di formattazione non collegati al task.

## Lingua E Testi Del Prodotto

- Lavora con il proprietario del progetto in italiano di default.
- La UI del prodotto/tool deve essere scritta in italiano, salvo funzionalita' che richiedano esplicitamente un'altra lingua.
- Copy utente, label, messaggi di validazione, stati vuoti e documentazione destinata agli utenti finali devono essere in italiano.
- Mantieni gli identificatori nel codice in inglese quando questo e' piu' coerente con le convenzioni di librerie e framework esistenti.

## Setup

- Installa le dipendenze con `npm ci`.
- Usa `npm run build` come comando principale di validazione.
- Usa `npm run lint` quando le modifiche toccano TypeScript, React, routing o componenti UI condivisi.
- Usa `npm audit --audit-level=moderate` dopo modifiche alle dipendenze.

## Linee Guida Per La Review

- Controlla che il routing in `src/routes` non sia rotto.
- Controlla che le modifiche UI restino responsive su mobile e desktop.
- Controlla che gli aggiornamenti alle dipendenze non disallineino `package.json` e `package-lock.json`.
- Segnala problemi di sicurezza nella gestione degli input utente, HTML generato, link, form e modifiche alle dipendenze.
