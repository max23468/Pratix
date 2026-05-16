# ADR 0013 — Focus recupero crediti

- **Stato**: Accettato
- **Data**: 2026-05-03
- **Decisori**: proprietario Pratix

## Contesto

Dopo la migrazione tecnica a GitHub, Vercel e Supabase, Pratix deve evolvere da
gestionale legale generalista a SaaS più focalizzato.

Il nuovo uso prevalente è il recupero crediti: l'avvocato freelance lavora per
committenti che gestiscono portafogli di clienti e pratiche contro controparti.
Il modello precedente, basato su cliente -> pratica -> scadenze/spese/fatture,
non distingue abbastanza il soggetto fatturato dal soggetto titolare della
posizione.

In parallelo, alcune regole lessicali storiche diventano troppo rigide:

- **attività** non può più essere vietata, perché diventa il nome naturale delle
  voci operative e fatturabili dentro la pratica;
- **studio** non deve essere usata per riposizionare Pratix verso studi
  associati, ma non resta una parola vietata in assoluto nei contesti in cui è
  corretta o inserita dall'utente.

## Decisione

Pratix resta un SaaS per avvocati freelance, ma il dominio funzionale primario
diventa il recupero crediti con **Pratica** al centro e con modello esplicito:

```text
Committente -> Cliente -> Controparte -> Pratica -> Attività -> Fattura
```

Il modulo scadenze viene rimosso dal perimetro evolutivo. Le attività
fatturabili, i compensi/onorari, i rimborsi spese Art. 15, i prezzi annuali
per committente, gli allegati, la fatturazione per committente + periodo e i
rendiconti Excel nel formato del committente diventano il nuovo nucleo prodotto.

## Conseguenze

- Il destinatario della fattura è il **Committente**, non necessariamente il
  Cliente.
- **Cliente** indica il soggetto collegato al portafoglio del committente e alla
  posizione creditoria.
- **Controparte** diventa entità strutturata, anche composta da più soggetti,
  senza ruoli applicativi e con dati anagrafici minimi.
- La **Pratica** mantiene numero numerico unico per utente, inseribile
  manualmente o generabile automaticamente.
- Le **Attività** hanno solo stato minimo: da fatturare o fatturata.
- I compensi, chiamati anche onorari, derivano dai prezzi annuali del
  committente; ogni committente può abilitare compensi, rimborsi spese o
  entrambi.
- Il totale dei compensi è calcolato come quantità attività x prezzo unitario.
- I rimborsi spese sono sempre anticipazioni Art. 15; i compensi/onorari sono
  sempre imponibili.
- Le spese generali sono opzionali in fatturazione e valgono il 10% del totale
  compensi quando attivate.
- La cassa forense 4% si applica solo a compensi + spese generali, mai ai
  rimborsi spese Art. 15.
- Gli allegati sono facoltativi e ammessi sia per compensi sia per rimborsi,
  con upload, download, anteprima, nome descrittivo, note e tipo documento.
- L'import archivio è stato successivamente ristretto alla Creazione guidata
  manuale da ADR 0016.
- La fattura al committente richiede anche rendiconti Excel nel formato fornito
  dal committente.
- Le regole operative su glossario, roadmap e futuri interventi devono
  privilegiare il recupero crediti.

## Alternative considerate

- **Restare gestionale generalista** — scartato perché non risolve il flusso
  committente/cliente/controparte e disperde lo sviluppo su moduli non centrali.
- **Rinominare Pratica in Posizione** — scartato: "Pratica" resta più coerente
  col prodotto, mentre "posizione" può restare sinonimo descrittivo.
- **Mantenere lo scadenzario come modulo autonomo** — scartato perché non serve
  nel perimetro indicato e aumenterebbe complessità.
- **Consentire importi compensi modificabili per pratica** — scartato: i prezzi
  annuali del committente definiscono gli importi unitari e devono restare
  coerenti.

## Riferimenti

- [Piano evoluzione recupero crediti](../plans/evoluzione-recupero-crediti.md)
- [ADR 0005 — Target freelance](./0005-target-freelance-no-studio.md)
- [ADR 0016 — Creazione guidata manuale](./0016-creazione-guidata-manuale.md)
