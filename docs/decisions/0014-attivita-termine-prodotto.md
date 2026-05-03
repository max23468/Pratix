# ADR 0014 — Attivita come termine di prodotto

- **Stato**: Accettato
- **Data**: 2026-05-03
- **Decisori**: proprietario Pratix

## Contesto

Nel vecchio posizionamento generalista, la parola "attivita" era stata esclusa
dalle label di prodotto perche' ambigua: poteva indicare sia l'impresa del
professionista sia una singola azione operativa.

Con il focus recupero crediti, pero', il nucleo operativo di Pratix cambia. La
pratica contiene registrazioni fatturabili, cioe' compensi/onorari e rimborsi
spese, che devono essere inserite, controllate, rinviate e poi fatturate al
committente. Per questo flusso "Attivita" e' diventato il termine piu' naturale
e comprensibile.

## Decisione

**Attivita** diventa termine ufficiale di prodotto e indica una registrazione
operativa e fatturabile collegata a una pratica: compenso/onorario o rimborso
spese, con data, quantita' o importo, stato, eventuali udienze e allegati.

Pratix espone inoltre una sezione globale **Attivita** per l'inserimento rapido
e il controllo trasversale delle stesse righe gia' visibili nel dettaglio della
singola pratica.

## Conseguenze

- La decisione supera la nota storica di ADR 0005 che vietava "Attivita" come
  label di prodotto.
- La tab della pratica resta la vista contestuale delle attivita' della pratica.
- La route `/attivita` e' la vista globale e rapida sulle stesse righe
  `case_activities`, senza creare un modello dati duplicato.
- "Professione" resta il termine corretto per parlare del lavoro o dei dati
  professionali dell'utente.
- "Task" e "action" restano da evitare nella UI italiana.

## Alternative considerate

- **Mantenere "Voci fatturabili" come label primaria** — scartato: e' preciso,
  ma meno naturale come voce di navigazione e meno adatto all'inserimento
  rapido.
- **Usare "Prestazioni"** — scartato: copre bene i compensi, ma non i rimborsi
  spese e gli allegati operativi.
- **Usare "Movimenti"** — scartato: troppo contabile e potenzialmente confonde
  il prodotto con una suite amministrativa.

## Riferimenti

- [ADR 0013 — Focus recupero crediti](./0013-focus-recupero-crediti.md)
- [Glossario](../glossario.md)
- [Piano evoluzione recupero crediti](../plans/evoluzione-recupero-crediti.md)
