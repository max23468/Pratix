# Roadmap — Pratix

Documento vivo per direzione, priorità e prossimi passi. Le decisioni stabili
stanno negli ADR, nelle guide o nella memoria di progetto; lo storico esteso
della vecchia roadmap sta in `docs/plans/pratix-roadmap-archive.md`.

Legenda: `Ora` lavoro immediato · `Prossimo` priorità successiva · `Più avanti`
direzione futura reale · `Bloccato` dipendenze o stop condition · `Fatto
recente` storico breve.

## Ora

- Chiudere l'hardening operativo P0/P1 prima di nuove aperture funzionali su
  superfici sensibili: controllo `.env` tracciati, secret scanning/gate,
  pattern a rischio in template e documentazione, log e workflow con secret.
- Mantenere Pratix nel perimetro recupero crediti freelance: niente suite da
  studio associato, niente email/push o provider esterni nel primo blocco 2.0.
- Preparare il piano tecnico del Controllo qualità operativo come primo
  incremento 2.0, senza saltare schema dati, RLS, server functions, generatore
  segnali, cron, ricalcolo manuale e superfici UI minime.

## Prossimo

- Implementare i primi cinque segnali qualità approvati: controparte forse
  composta, controparte composta incompleta, pratica senza prossima azione
  chiara, attività con importo da verificare e fattura scaduta non pagata.
- Esporre i segnali in Dashboard, Pratica, Cliente, Controparte, Attività e
  Fattura con titolo breve, motivo, gravità, stato e azione primaria.
- Dopo il primo incremento qualità, trasformare il Centro documenti Pratica in
  piano tecnico separato: schema dati, Storage e UI della tab `Documenti`.

## Più avanti

- Evolvere la campanella Novità in centro notifiche operative in-app, senza
  email o push nel primo perimetro.
- Introdurre Piano operativo della Pratica e Agenda operativa leggera solo come
  derivati del workflow esistente, non come scadenzario autonomo.
- Far maturare la Dashboard 2.0 verso una vista prescrittiva su cosa fare oggi.
- Rivalutare bozze assistite, email e notifiche esterne solo dopo validazione
  del metodo guidato e dei segnali qualità.

## Bloccato

- Nuovi deploy o feature su superfici operative sensibili restano da evitare
  finché P0/P1 hardening non sono verificati su `main`.
- Eventuali aperture commerciali o piani a pagamento richiedono decisione
  separata su pricing, privacy, supporto e capacità operativa.

## Fatto recente

- Pratix 1.0 è stato pubblicato con flussi core per pratiche, soggetti,
  attività, fatture, PDF/XML, rendiconti ed export dati.
- Il dominio prodotto è stato rifocalizzato sul recupero crediti per avvocati
  freelance, con glossario, brand, tema, accessibilità e UI operative allineati.
- La base tecnica per ritmi ricorrenti, workflow, controlli qualità e duplicati
  è presente e riutilizzabile per Pratix 2.0.
- La strategia test/smoke comprende coverage applicativa, smoke accessibilità e
  flussi autenticati proporzionati al rischio del diff.

## Regole

- La roadmap non è un changelog.
- La roadmap non è un archivio di feature completate.
- Le idee non promosse stanno in `docs/BACKLOG.md`.
- Le decisioni stabili stanno in ADR, guide o memoria; la roadmap le cita solo
  quando cambiano priorità, direzione o fase.
- Gli item completati restano solo come sintesi recente; i dettagli storici
  stanno nell'archivio o nei documenti dedicati.
- Ogni voce attiva deve indicare un prossimo passo operativo reale.
