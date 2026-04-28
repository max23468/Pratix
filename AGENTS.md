# AGENTS.md

## Scopo

Questo file definisce le linee guida operative per agenti, Codex e collaboratori che lavorano su Pratix.

Obiettivo: mantenere modifiche coerenti, sicure, testate e facilmente revisionabili, senza introdurre lavoro collaterale non richiesto.

## Priorità delle istruzioni

1. Istruzioni di sistema/developer ricevute nella sessione corrente.
2. Questo file `AGENTS.md`.
3. Documentazione progetto, quando presente.
4. Assunzioni dell'agente.

In caso di conflitto, seguire sempre il livello più alto.

## Aspettative sul repository

- Questa è un'app React TanStack Start/Vite generata con Lovable.
- Usa `npm` per installare e gestire le dipendenze perché il repository include `package-lock.json`.
- Mantieni `package.json` e `package-lock.json` allineati quando tocchi le dipendenze.
- Non duplicare manualmente in `vite.config.ts` i plugin già forniti da `@lovable.dev/vite-tanstack-config`.
- Non modificare manualmente `src/routeTree.gen.ts`: è generato da TanStack Router e può essere sovrascritto.
- Mantieni le modifiche focalizzate ed evita refactor, rinominazioni massive o cambi di formattazione non collegati al task.

## Prima di intervenire

- Controlla rapidamente lo stato del repo con `git status --short`.
- Prima di proporre architetture o refactor, leggi il codice, i test e i file di configurazione pertinenti.
- Per modifiche a routing o pagine, controlla i file vicini in `src/routes` e verifica che il routing non venga rotto.
- Non sovrascrivere o revertire modifiche non tue: ignorale se sono estranee al task, oppure lavora attorno a esse.
- Se la richiesta è ambigua su scope, comportamento atteso, rischio o tradeoff, chiedi chiarimento prima di procedere. Procedi con un'assunzione dichiarata solo per dettagli marginali che non cambiano il risultato sostanziale.

## Lingua e testi del prodotto

- Lavora con il proprietario del progetto in italiano di default.
- La UI del prodotto/tool deve essere scritta in italiano, salvo funzionalità che richiedano esplicitamente un'altra lingua.
- Copy utente, label, messaggi di validazione, stati vuoti, errori, meta tag e documentazione destinata agli utenti finali devono essere in italiano quando vengono creati o modificati.
- Per superfici utente italiane, usa `lang="it"` nell'HTML o aggiorna il valore esistente quando tocchi il root layout.
- Mantieni gli identificatori nel codice in inglese quando questo è più coerente con le convenzioni di librerie e framework esistenti.

## Qualità UI React

- Segui le convenzioni già presenti nel progetto e nei componenti shadcn/Radix in `src/components/ui`.
- Usa `lucide-react` per le icone quando esiste un'icona adatta.
- Mantieni le UI responsive su mobile e desktop, con testi che non escano dai contenitori e controlli che restino utilizzabili.
- Preferisci componenti piccoli, leggibili e coerenti con il design system esistente.
- Non introdurre nuove dipendenze UI o librerie di stato senza motivazione esplicita e impatto chiaro.

## Sicurezza e dati

- Non committare segreti, token, credenziali, file `.env` reali o dati personali.
- Valida e tratta con cautela input utente, form, link esterni, HTML generato e contenuto renderizzato dinamicamente.
- Evita leak di dati sensibili in log, errori, trace, screenshot o fixture.
- Per modifiche alle dipendenze, valuta il rischio di supply chain e usa `npm audit --audit-level=moderate`.

## Setup e verifica

- Installa le dipendenze con `npm ci`.
- Usa `npm run build` come comando principale di validazione.
- Usa `npm run lint` quando le modifiche toccano TypeScript, React, routing, componenti UI condivisi o configurazione correlata.
- Usa `npm audit --audit-level=moderate` dopo modifiche alle dipendenze.
- Usa `npm run ci:local` come gate completo quando la modifica è abbastanza ampia da giustificarlo.
- Per modifiche solo documentali, non serve inventare test applicativi: rileggi il documento e verifica la coerenza delle istruzioni.
- Non inventare risultati di test o comandi non eseguiti. Se un controllo non può essere eseguito, dichiaralo esplicitamente con motivo e rischio residuo.

## Documentazione, commit e PR

- Aggiorna documentazione o note operative quando cambiano comportamento utente, comandi, env var, deploy, configurazione o policy di sviluppo.
- Non aggiungere workflow GitHub, policy di deploy o flussi di release non presenti senza richiesta esplicita.
- Quando crei commit, mantienili atomici e usa Conventional Commit coerenti con l'impatto reale (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`).
- Nelle PR o nei riepiloghi finali, riporta in modo concreto cosa è cambiato, dove, eventuali rischi residui e verifiche rilevanti. Evita footer rituali se non aggiungono valore.

## Linee guida per la review

- Controlla che il routing in `src/routes` non sia rotto.
- Controlla che le modifiche UI restino responsive su mobile e desktop.
- Controlla che gli aggiornamenti alle dipendenze non disallineino `package.json` e `package-lock.json`.
- Segnala problemi di sicurezza nella gestione degli input utente, HTML generato, link, form e modifiche alle dipendenze.

## Definizione di done

Una modifica è pronta se:

- risolve la richiesta senza regressioni evidenti;
- mantiene coerenza con architettura, stack e convenzioni esistenti;
- non rompe routing, build o UI responsive nelle aree toccate;
- include verifiche eseguite o limiti noti quando rilevanti;
- aggiorna documentazione solo quando serve davvero;
- non lascia file temporanei, dati sensibili o modifiche non correlate.
