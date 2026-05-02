## Il problema

Oggi `/impostazioni` mescola due cose molto diverse:

1. **Chi sei come persona/utente Pratix** — email di login, password, nome, tema preferito, sessione.
2. **Come fatturi** — partita IVA, regime fiscale, aliquote, IBAN, numerazione, sede dell'attività.

L'utente che vuole "cambiare la password" o "vedere con che email è loggato" non dovrebbe scorrere 5 tab fiscali. E viceversa: chi imposta le aliquote IVA non si aspetta di trovarci la sicurezza dell'account.

La nuova area /account sarà implementata vicino alla campanella e non in sidebar.

## La proposta: due aree distinte

### `/account` — "Io come utente Pratix"

Contesto **personale e di accesso**. Cosa contiene:

- **Identità**: nome titolare (`full_name`), email di contatto personale, foto/avatar (futuro)
- **Accesso**: email di login (read-only, da Supabase Auth), cambio password, ultimo accesso, sessioni attive (futuro)
- **Aspetto**: tema chiaro/scuro/sistema (oggi è in Impostazioni → Aspetto, ma è una preferenza personale, non dell'attività)
- **Notifiche** (placeholder per il futuro: campanella changelog, email)
- **Zona pericolosa**: logout da tutti i dispositivi, esportazione dati, eliminazione account (placeholder)

### `/impostazioni` — "La mia attività professionale"

Contesto **business/configurazione**. Resta tutto il resto:

- **Attività**: ragione sociale, P.IVA, CF, ordine, PEC, telefono dell'attività, sede
- **Fiscale**: regime, aliquote di default
- **Pagamenti**: banca, IBAN
- **Numerazione**: prefisso, anno, prossimo numero

Rinomina mentale: Impostazioni = "configurazione del gestionale", Account = "il tuo profilo Pratix".

## Perché questa separazione

- **Convenzione SaaS consolidata**: praticamente ogni gestionale (Notion, Linear, Stripe, Fatture in Cloud) separa "Account/Profile" personale da "Workspace/Settings" di configurazione. Gli utenti si aspettano questa divisione.
- **Coerenza col target**: l'avvocato freelance è sia _utente_ che _attività_, ma sono comunque due cappelli diversi. Cambiare password ≠ cambiare aliquota IVA.
- **Zero conflitti dati**: tutti i campi vivono già nella stessa tabella `profiles`, semplicemente li dividiamo per **superficie UI**, non per schema. Nessuna migrazione DB.
- **Estensibilità futura**: l'area Account è il posto naturale per 2FA, sessioni, esportazione GDPR, billing del piano Pratix (quando ci sarà).

## Navigazione

Sidebar (in basso, sopra "Esci"):

```
…voci principali…
─────────────────
⚙  Impostazioni      → /impostazioni
👤 Account           → /account
↗  Esci
```

Entrambe in fondo, raggruppate visivamente. Icona `User` da lucide per Account, mantiene `Settings` per Impostazioni.

In più, aggiungiamo nel **dropdown utente in topbar** (se/quando lo introdurremo) link diretti ad Account → questa è la destinazione "naturale" cliccando sul proprio nome.

## Cosa cambia in pratica

1. **Nuova route** `src/routes/account.tsx` con tab interne:

- `Profilo` (nome, email contatto)
- `Accesso e sicurezza` (email login read-only, cambio password)
- `Aspetto` (sposto qui la card tema da Impostazioni)
- `Notifiche` (placeholder con coming-soon, oppure on/off campanella se vogliamo subito)

2. **Modifico `/impostazioni**`: rimuovo la tab "Aspetto" (va in Account). Le altre 4 tab restano: Attività, Fiscale, Pagamenti, Numerazione. Aggiorno description del PageHeader: "I dati della tua attività professionale, fiscalità, IBAN e numerazione".
3. **Cambio password**: implemento via `supabase.auth.updateUser({ password })` con conferma. Non serve la flow di reset, l'utente è già autenticato.
4. **Sidebar** (`src/components/app-sidebar.tsx`): aggiungo voce Account con icona `User`, posizionata accanto a Impostazioni.
5. **Footer versione + link "Cosa è cambiato"**: oggi è in fondo a Impostazioni. Lo sposto in **Account → Profilo** (contesto utente personale, ha più senso lì che tra le aliquote IVA).
6. **Rotta `/reimposta-password**`: resta com'è, è il flow non-autenticato per chi ha dimenticato la password.
7. **Documentazione**:

- Aggiorno `ROADMAP.md` (sezione Account)
- Nota in `mem://process/roadmap` mirror
- Voce in `CHANGELOG.md` sotto `[Non rilasciato]` → `### Novità`: "Nuova area Account separata da Impostazioni: profilo, accesso, sicurezza e aspetto in un posto solo."

## Cosa NON faccio (per non sovraccaricare)

- Niente avatar/upload foto (placeholder visivo, implementazione poi)
- Niente 2FA (placeholder, dipende da config Supabase)
- Niente sessioni attive multiple (richiede policy lato Supabase)
- Niente eliminazione account (operazione delicata, ADR a parte quando deciderai)
- Niente migrazione DB (lo schema attuale è già adatto)

## Dettagli tecnici

- File nuovo: `src/routes/account.tsx` (pattern come `impostazioni.tsx`: query `profiles`, mutation update, tab shadcn)
- Cambio password: form con `current_password` (riautenticazione via `signInWithPassword`) + `new_password` + conferma, poi `auth.updateUser`
- Email di login: letta da `useAuth().user.email`, mostrata read-only con nota "Per cambiarla contatta il supporto" (cambio email Supabase richiede conferma via mail, lo facciamo in una iterazione futura)
- Sposto il componente `AppearanceCard` da `impostazioni.tsx` a un nuovo `src/components/appearance-card.tsx` riutilizzabile
- Rimozione tab `aspetto` da impostazioni.tsx
- Aggiunta voce sidebar con icona `User` da lucide-react

## Domanda aperta

Per l'icona Account in sidebar preferisci `User` (silhouette) o `CircleUser` (più "avatar-like")? Vado con `User` se non specifichi.
