# Hardening tecnico-operativo (2026-05-27)

## Rischio iniziale

- Livello: **alto (bloccante)**.
- Stato in questa ondata: **P0/P1** per riaprire nuovi lavori non hardening.
- Rotazione segreti: **esclusa** in questa fase (espressamente non prevista dal piano).

## Contesto operativo rilevante

- Prodotto con integrazioni esterne, auth/sicurezza Supabase e superficie Vercel.
- Obiettivo: rimuovere rischi di secret leakage e garantire controllo pre-merge.

## Piano tecnico (P0/P1/P2)

### P0

- Nessun file `.env` tracciato in repository e nessun segreto in template/config condivisi.
- Verifica della storia Git su eventuale esposizione pregressa.
- Attivare guardrail pre-merge per secret scan e blocco pattern sensibili.
- Bloccare commit accidentali con `.env` e segreti nei workflow.

### P1

- Bloccare pattern sensibili in `SECURITY.md`, `docs/ROADMAP.md`, guide e snippet di onboarding.
- Rafforzare CI/pre-commit per log e payload (niente PII/segreti nei log applicativi).
- Formalizzare check periodico su policy RLS e accessi Supabase.

### P2

- Audit periodici di:
  - accessi amministrativi;
  - utilizzo token runtime;
  - regressioni autorizzative e logiche policy.
- Integrare revisione rischio nel ciclo operativo continuo.

## Piano operativo e di governo

- Per Pratix: **non aprire nuovi interventi funzionali** prima della chiusura completa di P0 e P1.
- Obiettivo operativo:
  - `0` hit in secret scan;
  - `0` file `.env` tracciati;
  - `0` segreti emersi nei log.
- Monitorare i cambi nelle policy di integrazione e rivedere questa pagina dopo ogni modifica stack.
