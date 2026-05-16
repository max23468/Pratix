# Architecture Decision Records (ADR)

Ogni decisione architetturale, di prodotto o di brand "presa per sempre" vive qui come ADR numerato.

## Quando creare un ADR

Crea un ADR quando:

- la scelta è **difficile da invertire** (cambio stack, schema dati, modello di pricing)
- ci sono **alternative reali** che meritano di essere ricordate
- futuri collaboratori si chiederanno "perché?" leggendo il codice
- la decisione riguarda **identità del prodotto** (target, naming, tono)

**Non** creare un ADR per:

- piccole scelte di implementazione locali
- fix di bug
- preferenze di formattazione

## Template

Copia [`template.md`](./template.md) (o segui questo schema), incrementa il numero, dai un titolo breve in kebab-case:

```
docs/decisions/0007-titolo-breve.md
```

### Schema

```markdown
# ADR 000N — Titolo

- **Stato**: Proposto | Accettato | Sostituito da ADR 00XX | Deprecato
- **Data**: YYYY-MM-DD
- **Decisori**: nome / ruoli

## Contesto

Cosa stava succedendo? Quale problema andava risolto?

## Decisione

Cosa abbiamo deciso, in una frase chiara.

## Conseguenze

Cosa diventa più semplice, cosa più complicato, vincoli che accettiamo.

## Alternative considerate

Cosa abbiamo valutato e perché l'abbiamo scartato.

## Riferimenti

Link a issue, PR, documenti, conversazioni rilevanti.
```

## Indice

| #                                                      | Titolo                                                 | Stato                              |
| ------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------- |
| [0001](./0001-stack-tanstack-start.md)                 | Stack frontend: TanStack Start                         | Accettato                          |
| [0002](./0002-lovable-cloud-supabase.md)               | Backend: Lovable Cloud (Supabase)                      | Sostituito come target da ADR 0009 |
| [0003](./0003-fatturapa-td06-parcella.md)              | FatturaPA: tipo documento TD06 (Parcella)              | Accettato                          |
| [0004](./0004-tagline-tutto-torna.md)                  | Tagline ufficiale: "Tutto torna."                      | Accettato                          |
| [0005](./0005-target-freelance-no-studio.md)           | Target esplicito freelance: vietata la parola "studio" | Accettato                          |
| [0006](./0006-tema-auto-piu-override.md)               | Tema: auto + override manuale, dark mode rilassante    | Accettato                          |
| [0007](./0007-palette-inchiostro-terracotta.md)        | Palette inchiostro + terracotta                        | Accettato                          |
| [0008](./0008-versioning-e-changelog.md)               | Versioning e changelog                                 | Accettato                          |
| [0009](./0009-uscita-completa-da-lovable.md)           | Uscita completa da Lovable                             | Accettato                          |
| [0010](./0010-release-automatizzata.md)                | Release automatizzata locale                           | Accettato                          |
| [0011](./0011-gestione-settimanale-commenti-codex.md)  | Gestione settimanale commenti Codex                    | Sostituito da ADR 0015             |
| [0012](./0012-storage-e-observability-vercel-first.md) | Storage privato e observability Vercel-first           | Accettato                          |
| [0013](./0013-focus-recupero-crediti.md)               | Focus recupero crediti                                 | Accettato                          |
| [0014](./0014-attivita-termine-prodotto.md)            | Attivita come termine di prodotto                      | Accettato                          |
| [0015](./0015-inbox-event-driven-commenti-codex.md)    | Inbox event-driven commenti Codex                      | Accettato                          |
| [0016](./0016-creazione-guidata-manuale.md)            | Creazione guidata manuale                              | Accettato                          |
