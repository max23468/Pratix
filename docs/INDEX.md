# Indice documentazione Pratix

Cartella che raccoglie tutta la documentazione approfondita del progetto.

## Struttura

```
docs/
├── INDEX.md            ← indice canonico
├── CONTEXT.md          ← handoff operativo
├── ROADMAP.md          ← roadmap canonica
├── BACKLOG.md          ← idee, debiti e ipotesi non promosse
├── TOOLCHAIN.md        ← runtime, comandi e verifiche
├── doppler-setup.md    ← integrazione Doppler e verifica segreti CI
├── DECISIONS.md        ← indice decisionale stabile
├── DECISIONS_PENDING.md← decisioni strutturali non ancora approvate
├── glossario.md        ← termini legali e fiscali italiani
├── memory/             ← memoria di progetto in markdown (specchio di mem://)
│   ├── MEMORY_MIRROR.md
│   ├── core.md
│   ├── brand.md
│   └── roadmap.md
├── migration/          ← inventari e note tecniche di migrazione sanitizzati
│   ├── lovable-inventory.md
│   └── lovable-reference-audit.md
├── guides/             ← guide tematiche operative
│   ├── architettura.md
│   ├── database.md
│   ├── deploy.md
│   ├── fatturazione.md
│   ├── migrations.md
│   ├── react-doctor.md
│   ├── smoke-a11y.md
│   ├── tema-e-design.md
│   ├── tono-di-voce.md
│   ├── uscita-lovable.md
│   └── versioning-e-release.md
└── decisions/          ← Architecture Decision Records
    ├── template.md
    └── 0001…0016-*.md
```

## Quando consultare cosa

| Vuoi…                                                  | Vai a…                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Riprendere rapidamente il contesto operativo           | [`CONTEXT.md`](./CONTEXT.md)                                                     |
| Vedere stato e priorità                                | [`ROADMAP.md`](./ROADMAP.md)                                                     |
| Consultare idee, debiti e ipotesi parcheggiate         | [`BACKLOG.md`](./BACKLOG.md)                                                     |
| Controllare runtime, comandi e verifiche               | [`TOOLCHAIN.md`](./TOOLCHAIN.md)                                                 |
| Verificare integrazione Doppler e segreti CI           | [`doppler-setup.md`](./doppler-setup.md)                                         |
| Capire stack, struttura cartelle, routing              | [`guides/architettura.md`](./guides/architettura.md)                             |
| Lavorare su tabelle, RLS, migrazioni                   | [`guides/database.md`](./guides/database.md)                                     |
| Consultare stato migrazione e dismissione Lovable      | [`guides/uscita-lovable.md`](./guides/uscita-lovable.md)                         |
| Consultare l'inventario tecnico sanitizzato            | [`migration/lovable-inventory.md`](./migration/lovable-inventory.md)             |
| Verificare quali riferimenti storici a Lovable restano | [`migration/lovable-reference-audit.md`](./migration/lovable-reference-audit.md) |
| Capire FatturaPA, calcoli IVA, regime forfettario      | [`guides/fatturazione.md`](./guides/fatturazione.md)                             |
| Cambiare colori, tema, componenti                      | [`guides/tema-e-design.md`](./guides/tema-e-design.md)                           |
| Scrivere microcopy o label                             | [`guides/tono-di-voce.md`](./guides/tono-di-voce.md)                             |
| Pubblicare o configurare il dominio                    | [`guides/deploy.md`](./guides/deploy.md)                                         |
| Gestire release e changelog                            | [`guides/versioning-e-release.md`](./guides/versioning-e-release.md)             |
| Eseguire smoke test accessibilità/UI                   | [`guides/smoke-a11y.md`](./guides/smoke-a11y.md)                                 |
| Lavorare sulle migrazioni Supabase                     | [`guides/migrations.md`](./guides/migrations.md)                                 |
| Diagnosticare warning React ricorrenti                 | [`guides/react-doctor.md`](./guides/react-doctor.md)                             |
| Sapere perché abbiamo scelto X                         | [`DECISIONS.md`](./DECISIONS.md)                                                 |
| Vedere decisioni non ancora approvate                  | [`DECISIONS_PENDING.md`](./DECISIONS_PENDING.md)                                 |
| Capire un termine di dominio                           | [`glossario.md`](./glossario.md)                                                 |
| Vedere le regole sempre attive                         | [`memory/core.md`](./memory/core.md)                                             |

## Documentazione fuori da `docs/`

I file nella root del repo (`README.md`, `AGENTS.md`, `BRAND.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`) restano al primo livello perché sono punti d'ingresso convenzionali per chi atterra sul repository. La roadmap canonica e la documentazione di governo vivono in `docs/`.

La repo mantiene basename Markdown univoci: non creare nuovi `README.md` o
`ROADMAP.md` in sottocartelle quando esiste già un documento canonico con lo
stesso basename.
