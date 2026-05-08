# Memoria — Roadmap

> Mirror di `mem://process/roadmap`. La roadmap completa con stato per area vive in [`../../ROADMAP.md`](../../ROADMAP.md).

## Regola di sincronizzazione

**Ogni decisione di prodotto, brand o tecnica condivisa in chat deve confluire in `ROADMAP.md`.**

Stato delle voci con legenda:

- ✅ fatto
- 🟡 in corso
- ⬜ da fare
- 💤 idea / parcheggiato

## Aree tracciate

1. **Identità e brand** — quasi tutto ✅
2. **Tema e accessibilità** — base ✅, audit accessibilità ⬜
3. **Landing pubblica** — hero ✅, resto ⬜
4. **Esperienza prodotto** (UI autenticata) — base ✅, rifinitura ⬜
5. **Funzionalità di prodotto** — focus recupero crediti, schema Fase 2 completato, committenti/clienti/controparti/pratiche/attività/prezzi per committente/fatturazione per committente e periodo/rendiconti Excel; scadenzario e vecchio modulo spese rimossi
6. **Account, sicurezza, dati** — auth base ✅, area `/account` separata da Impostazioni ✅, cambio password in-app ✅, Supabase Storage privato ✅, eliminazione/GDPR/cambio email ⬜
7. **SEO, pubblicazione, dominio** — `lang="it"` ✅, resto ⬜
8. **Qualità e processo** — `AGENTS.md`/`BRAND.md`/`ROADMAP.md` ✅, Observability Vercel-first ✅, strategia test automatizzati ⬜, test critici ⬜

## Quando aggiornare

- Una voce cambia stato → aggiornala in `ROADMAP.md` e, se rilevante, in `CHANGELOG.md`.
- Emerge una nuova area di lavoro → aggiungi una sezione in `ROADMAP.md`.
- Una decisione architetturale è "presa per sempre" → crea un ADR in [`../decisions/`](../decisions/).
