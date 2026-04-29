# Documentazione di Pratix

Cartella che raccoglie tutta la documentazione approfondita del progetto.

## Struttura

```
docs/
├── README.md           ← questo file
├── glossario.md        ← termini legali e fiscali italiani
├── memory/             ← memoria di progetto in markdown (specchio di mem://)
│   ├── README.md
│   ├── core.md
│   ├── brand.md
│   └── roadmap.md
├── guides/             ← guide tematiche operative
│   ├── architettura.md
│   ├── database.md
│   ├── fatturazione.md
│   ├── tema-e-design.md
│   ├── tono-di-voce.md
│   └── deploy.md
└── decisions/          ← Architecture Decision Records
    ├── README.md
    └── 0001…0006-*.md
```

## Quando consultare cosa

| Vuoi… | Vai a… |
|---|---|
| Capire stack, struttura cartelle, routing | [`guides/architettura.md`](./guides/architettura.md) |
| Lavorare su tabelle, RLS, migrazioni | [`guides/database.md`](./guides/database.md) |
| Capire FatturaPA, calcoli IVA, regime forfettario | [`guides/fatturazione.md`](./guides/fatturazione.md) |
| Cambiare colori, tema, componenti | [`guides/tema-e-design.md`](./guides/tema-e-design.md) |
| Scrivere microcopy o label | [`guides/tono-di-voce.md`](./guides/tono-di-voce.md) |
| Pubblicare o configurare il dominio | [`guides/deploy.md`](./guides/deploy.md) |
| Sapere perché abbiamo scelto X | [`decisions/`](./decisions/) |
| Capire un termine di dominio | [`glossario.md`](./glossario.md) |
| Vedere le regole sempre attive | [`memory/core.md`](./memory/core.md) |

## Documentazione fuori da `docs/`

I file nella root del repo (`README.md`, `AGENTS.md`, `BRAND.md`, `ROADMAP.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`) sono al primo livello perché sono i punti d'ingresso convenzionali per chi atterra sul repository. La documentazione tematica e di lungo respiro vive qui dentro.
