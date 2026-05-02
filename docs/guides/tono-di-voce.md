# Guida — Tono di voce e microcopy

> Pratix parla all'avvocato freelance. Asciutto, preciso, senza paternalismo. La voce del prodotto è quella di un collega organizzato.

## Principi

1. **"Tu" professionale, neutro.** Mai "Lei", mai paternalistico, mai amichevole-da-app.
2. **Frasi brevi.** Stato del sistema, non narrazione.
3. **Concretezza.** Dire cosa è successo o cosa fare, non come ci si sente.
4. **Niente emoji nella UI.** Mai. Nemmeno una.
5. **Niente esclamativi multipli.** Un esclamativo è raro, due non esistono.
6. **Niente "Oops".** Niente "Ops". Niente "Whoops".

## Glossario obbligatorio

| ✅ Usare                                                   | ❌ Evitare                        |
| ---------------------------------------------------------- | --------------------------------- |
| Pratica                                                    | Caso, fascicolo                   |
| Cliente                                                    | Assistito                         |
| Scadenza                                                   | Deadline                          |
| Spese                                                      | Costi                             |
| Fattura, Parcella                                          | Conto                             |
| Professione, la tua professione, i tuoi dati professionali | **Studio**, "attività" come label |
| Salva, Annulla, Elimina                                    | Conferma, Procedi, Cancella       |

> **"Studio" è vietata.** Il target è il freelance singolo. Vedi [ADR 0005](../decisions/0005-target-freelance-no-studio.md).

## Tagline ufficiale

**"Tutto torna."** Sempre col punto finale. Mai tradurre. **Mai dentro la UI autenticata** — vive solo in marketing, landing, footer pubblico, meta tag. Nei title e nei meta tag usa sempre il separatore `·`: `Dashboard · Pratix`. La forma `Pratix · Tutto torna.` è riservata alla home pubblica. Vedi [ADR 0004](../decisions/0004-tagline-tutto-torna.md).

## Esempi

### Empty state

- ✅ "Nessuna pratica ancora. Inizia da _Nuova pratica_."
- ❌ "Ops! Sembra che tu non abbia ancora creato pratiche 😊"

### Errore

- ✅ "Partita IVA mancante. Configurala in Impostazioni."
- ❌ "Whoops! Ti sei dimenticato qualcosa!!"

### Conferma distruttiva

- ✅ "Eliminare la fattura **2026/0023**? L'azione non è reversibile."
- ❌ "Sei sicuro sicuro di voler procedere?? 🚨"

### Salvataggio riuscito

- ✅ "Modifiche salvate."
- ❌ "Yay! Tutto pronto ✨"

### Onboarding

- ✅ "Configura la tua professione in tre brevi passaggi. Potrai modificare tutto in seguito."
- ❌ "Bentornato!! Configuriamo insieme il tuo studio 🚀"

### Microcopy bottoni

- ✅ "Salva modifiche", "Crea pratica", "Genera XML", "Esporta PDF"
- ❌ "Conferma", "Procedi", "Click qui", "Vai!"

## Numeri, date, valuta

- **Importi**: formato italiano, due decimali, spazio prima del simbolo, `€` dopo. Esempio: `1.250,00 €`.
- **Date**: formato italiano `DD/MM/YYYY`. Per date relative: "oggi", "ieri", "tra 3 giorni".
- **Percentuali**: con spazio. `IVA 22 %` o `IVA al 22%` (preferire la seconda nei testi).
- **Tabelle e numeri allineati**: usare `font-mono` o classi `tabular-nums`.

## Maiuscole e punteggiatura

- **Title case**: solo per i titoli di sezione, brand, e tagline. Non per pulsanti.
- **Sentence case**: pulsanti, label, descrizioni.
- **Niente puntini di sospensione finti** (`...`): usare `…` quando serve davvero.
- **Trattini**: `—` (em dash) per incisi narrativi, mai `--` né `-`. Non usarlo nei title o nei meta tag di pagina: lì resta `·`.

## Lingua

- UI **sempre in italiano**.
- `lang="it"` sul root.
- Identificatori di codice in inglese quando coerente con framework e librerie. Le variabili interne non sono UI.
