# ADR 0016 — Creazione guidata manuale

- **Stato**: Accettato
- **Data**: 2026-05-16
- **Decisori**: proprietario Pratix

## Contesto

La procedura di import archivio aveva due modalità: inserimento manuale guidato
e import da Excel strutturato. La modalità Excel aggiungeva upload, parser,
mappatura colonne, validazione massiva e regole di deduplicazione, ma aumentava
la complessità del prodotto e della manutenzione rispetto al valore operativo
attuale.

La procedura manuale resta invece coerente con Pratix: accompagna il singolo
avvocato freelance nella creazione controllata di Pratica, soggetti collegati,
Attività storiche e allegati.

## Decisione

Pratix mantiene solo la Creazione guidata manuale e rimuove l'import Excel
strutturato come funzione di prodotto.

## Conseguenze

- La superficie utente viene rinominata in **Creazione guidata**.
- L'accesso principale vive nella dashboard e nella route
  `/creazione-guidata`, non nella sezione Account.
- La route `/import-archivio` viene rimossa senza redirect.
- Il parser `.xlsx`, l'anteprima Excel e i test dedicati vengono rimossi dal
  codice applicativo.
- Le tabelle `imports` e `import_rows` restano perché servono ancora allo
  staging e alla conferma transazionale della procedura manuale.
- I rendiconti Excel e i dossier Excel restano fuori da questa decisione: sono
  output del prodotto, non input di import.

## Alternative considerate

- **Mantenere entrambe le modalità** — scartato perché mantiene due flussi da
  spiegare, testare e correggere.
- **Nascondere solo la scheda Excel** — scartato perché avrebbe lasciato codice
  morto e una dipendenza di parsing non più collegata al prodotto.
- **Lasciare un redirect da `/import-archivio`** — scartato: la scelta è una
  pulizia semantica completa, quindi i link interni devono usare solo
  `/creazione-guidata`.

## Riferimenti

- [ROADMAP](../../ROADMAP.md)
- [ADR 0013 — Focus recupero crediti](./0013-focus-recupero-crediti.md)
