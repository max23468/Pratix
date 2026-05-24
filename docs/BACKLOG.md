# Backlog Pratix

Il backlog raccoglie idee, debiti e ipotesi non ancora promosse nella [roadmap](ROADMAP.md). Una voce qui non è scope approvato.

Pratix è già una repo matura: questo file non sostituisce i piani esistenti, ma rende più facile distinguere ciò che è prossimo da ciò che resta parcheggiato.

## Idee prodotto parcheggiate

- Time tracking per Pratica: fuori dal perimetro recupero crediti attuale.
- Email e notifiche esterne: fuori dal primo perimetro 2.0; rivalutare solo dopo centro notifiche in-app.
- Dominio custom: opzionale, non necessario nel percorso gratuito attuale.
- Funzionalità da studio associato, CRM generalista, suite contabile completa o piattaforma enterprise: fuori perimetro salvo nuova decisione esplicita e ADR.

## Pratix 2.0 da dettagliare

- Controllo qualità operativo: motore di segnali con gravità, motivo, azione proposta e stato.
- Sistema notifiche operative in-app, derivato da dati già presenti e senza provider esterni.
- Import rendiconti Excel assistito con staging, controllo duplicati e conferma esplicita prima della scrittura.
- Regole import: campi obbligatori, default sensati, comportamento su Pratica nuova/esistente e importi incerti.
- Piano operativo della Pratica: checklist e stati guidati dal workflow recupero crediti.
- Agenda operativa leggera collegata a Fatture, Attività, importi da verificare e pratiche ferme.
- Centro documenti Pratica: da valutare senza confonderlo con allegati economici o output già generati.
- Bozze assistite: supporto mirato a solleciti, note pratica, riepiloghi e descrizioni Attività.
- Dashboard 2.0 prescrittiva su cosa fare oggi.

## Debiti tecnici e operativi

- Continuare a mantenere `docs/memory/` come mirror leggibile della memoria di progetto quando cambiano regole stabili.
- Valutare se estrarre in documenti più piccoli parti storiche molto lunghe della roadmap, senza perdere contesto.
- Continuare il monitoraggio Vercel Observability, Web Analytics e Speed Insights dopo traffico reale.
- Controllare il cron giornaliero Vercel dopo i deploy che ne cambiano comportamento o configurazione.
- Mantenere React Doctor come gate per release major/minor o modifiche React trasversali secondo policy.

## Riferimenti

- [Piano evoluzione recupero crediti](plans/evoluzione-recupero-crediti.md)
- [Strategia test automatizzati](plans/strategia-test-automatizzati.md)
- [Pratix 1.0 readiness](plans/pratix-1-0-readiness.md)
- [Update latest dipendenze](plans/update-latest-dipendenze.md)
