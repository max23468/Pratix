# Roadmap — Pratix

> Documento vivo. Ogni decisione di prodotto, brand o tecnica condivisa in chat
> deve confluire qui. Aggiornare quando una voce cambia stato o ne emergono di nuove.
>
> Riferimenti: [`BRAND.md`](./BRAND.md), [`AGENTS.md`](./AGENTS.md), memoria di
> progetto in `mem://index.md`.

Legenda stato: ✅ fatto · 🟡 in corso · ⬜ da fare · 💤 idea / parcheggiato

---

## 0. Identità e brand

| Stato | Voce | Note |
|---|---|---|
| ✅ | Nome prodotto: **Pratix** | Gestionale per avvocati freelance |
| ✅ | Tagline ufficiale: **"Tutto torna."** | Triplo senso: contabile, narrativo, ordine. Fuori dalla UI autenticata. Nei title usa `·`: `Dashboard · Pratix`; `Pratix · Tutto torna.` solo in home |
| ✅ | Palette inchiostro + terracotta + panna | Token semantici in `src/styles.css`, mai hex inline. Differenziazione da Fineco/banche (ADR-0007). I nomi token `--brand-navy/gold` sono alias storici |
| ✅ | Logo adattivo cross-tema | Tone `navy` cambia tile/glifo fra light e dark via token `--logo-*` |
| ✅ | Tipografia: Inter Tight + Inter + JetBrains Mono | Numeri tabular-nums, display weight max 600 |
| ✅ | Logo unificato `<Logo>` + favicon SVG | Direzione default `px`, mai SVG inline |
| ✅ | Tono di voce "tu" professionale | No emoji UI, no esclamativi multipli |
| ✅ | Glossario freelance | Pratica/Cliente/Scadenza/Spese/Fattura — vietata "studio" |
| ⬜ | Pagina `/brand` o sezione interna riassuntiva | Non urgente; per ora basta `BRAND.md` |
| 💤 | Loghi alternativi (orizzontale scuro su panna, monocromo) | Solo se serviranno per export/press |

## 1. Tema e accessibilità

| Stato | Voce | Note |
|---|---|---|
| ✅ | Tema auto (sistema) + override manuale chiaro/scuro | Provider `src/lib/theme-context.tsx` |
| ✅ | Toggle in sidebar, landing, impostazioni | `<ThemeToggle>` |
| ✅ | No-flash script in `__root.tsx` | Evita FOUC al caricamento |
| ✅ | Dark mode "rilassante" | Grigio caldo neutro, croma bassa |
| ⬜ | Audit contrasto WCAG AA su entrambi i temi | Specie su muted, gold su panna, success/warning |
| ⬜ | Focus visibili e navigazione tastiera | Verifica su tutte le route |
| ⬜ | Riduci-movimento (`prefers-reduced-motion`) | Disabilitare animazioni non essenziali |

## 2. Landing pubblica

| Stato | Voce | Note |
|---|---|---|
| ✅ | Hero con tagline + CTA | "Tutto torna." come ancora visiva |
| ⬜ | Sezione "Perché Pratix" orientata al freelance | Tre/quattro promesse concrete |
| ⬜ | Mockup/screenshot di prodotto | Dashboard, fattura, pratica |
| ⬜ | Pricing | Decidere modello: free/trial/pro, mensile/annuale |
| ⬜ | FAQ | Domande tipiche: regime forfettario, FatturaPA, sicurezza dati |
| ✅ | Footer con Privacy e Termini | Pagine `/privacy` e `/termini` linkate |
| ✅ | Meta + og:image dedicati alla landing | og + twitter cards in root, immagine `/og-image.jpg` |
| ⬜ | Footer completo con contatti e P.IVA | Da aggiungere quando definiti gli estremi del titolare |

## 3. Esperienza prodotto (UI autenticata)

| Stato | Voce | Note |
|---|---|---|
| ✅ | Layout app + sidebar | `src/components/app-layout.tsx` |
| ✅ | Onboarding wizard 3 step | Anagrafica / Fiscale / Pagamenti |
| ⬜ | Empty states uniformi | Dashboard, Pratiche, Clienti, Fatture, Spese |
| ⬜ | Microcopy review pagina per pagina | Coerenza tono, glossario, "tu" |
| ⬜ | Scorciatoie tastiera | Almeno: nuova pratica, nuovo cliente, nuova fattura, ricerca globale |
| ⬜ | Ricerca globale (cmd+k) | Pratiche, clienti, fatture, scadenze |
| ⬜ | Filtri persistenti per pagina | Salvare in URL/query |
| ⬜ | Dati di esempio opzionali | Per esplorare l'app a freddo |

## 4. Funzionalità di prodotto

| Stato | Voce | Note |
|---|---|---|
| ✅ | Pratiche, Clienti, Fatture base | CRUD + visualizzazione |
| ✅ | Generazione fattura PDF | `src/lib/invoice-pdf.ts` |
| ✅ | Generazione XML FatturaPA (TD06) | `src/lib/invoice-xml.ts` |
| ⬜ | Scadenziario con notifiche | In-app + opzionale email |
| ⬜ | Time tracking per pratica | Timer + voci manuali |
| ⬜ | Spese con allegati | Upload ricevute via storage |
| ⬜ | Esportazione massiva fatture | ZIP PDF + XML per periodo |
| ⬜ | Numerazione automatica | Già presente? Verificare reset annuale |
| 💤 | Area cliente esterna | Login dedicato per visione fatture/scadenze |
| 💤 | Integrazione invio SDI | Oggi solo generazione XML; invio futuro |

## 5. Account, sicurezza, dati

| Stato | Voce | Note |
|---|---|---|
| ✅ | Registrazione + login | Email/password |
| ✅ | Recupero password | Pagine `/recupera-password` + `/reimposta-password`, email Supabase di default |
| ✅ | Messaggi auth generici (no user enumeration) | Login e registrazione |
| ✅ | Area Account separata da Impostazioni | `/account` con tab Profilo / Accesso e sicurezza / Aspetto / Notifiche, accesso da menu utente in topbar |
| ✅ | Cambio password in-app | Riautenticazione con password attuale + `auth.updateUser` |
| 🟡 | Email auth personalizzate (brand) | Post-cutover: oggi arrivano da Supabase Auth; valutare template italiani, mittente Pratix e dominio/SMTP dedicato |
| 💤 | Leaked Password Protection Supabase | Richiede piano Pro o superiore; non prevista nel percorso gratuito attuale |
| ⬜ | Cambio email | Con conferma sul nuovo indirizzo |
| ⬜ | Eliminazione account | Soft + hard delete con conferma |
| ⬜ | Esportazione dati personali | JSON/CSV per GDPR |
| ⬜ | Audit RLS su tutte le tabelle | Verifica policy per `user_id` |
| ⬜ | Auth Google opzionale | Da valutare in base al target |

## 6. SEO, pubblicazione, dominio

| Stato | Voce | Note |
|---|---|---|
| ✅ | `lang="it"` su root | |
| ✅ | Meta unici per route pubbliche | Landing, login, registrazione, recupero, privacy, termini |
| ✅ | og:image globale + Twitter card | `/og-image.jpg` |
| ⬜ | `sitemap.xml` + `robots.txt` | |
| ⬜ | JSON-LD `Organization` / `SoftwareApplication` | |
| 🟡 | Uscita completa da Lovable | ADR-0009 + guida `docs/guides/uscita-lovable.md`; runtime/backend già spostati |
| ✅ | Pubblicazione tramite Vercel | Produzione su `https://pratix.vercel.app`; dominio proprietario rimandato |
| ✅ | Migrazione backend fuori da Lovable Cloud | Supabase di proprietà collegato, dati migrati, auth verificata |
| ⬜ | Bonifica riferimenti Lovable | Al termine `rg -i "lovable\|@lovable\\.dev" .` deve restituire zero risultati nel working tree |
| 💤 | Dominio proprietario futuro | Eventuale dominio tipo `pratix.it` |

## 7. Qualità e processo

| Stato | Voce | Note |
|---|---|---|
| ✅ | `AGENTS.md` con regole operative | |
| ✅ | `BRAND.md` con guidelines | |
| ✅ | `ROADMAP.md` con stato per area | Questo file |
| ✅ | `README.md` di ingresso | Panoramica + mappa documenti |
| ✅ | `CHANGELOG.md` (Keep a Changelog) | Storico release |
| ✅ | `SECURITY.md` + `CONTRIBUTING.md` + `LICENSE` | Predisposti per repo pubblico |
| ✅ | Cartella `docs/` con guide tematiche | architettura, database, fatturazione, tema, tono di voce, deploy |
| ✅ | `docs/memory/` mirror di `mem://` | core, brand, roadmap |
| ✅ | `docs/decisions/` con 9 ADR | Stack, backend storico, FatturaPA, tagline, target freelance, tema, palette, versioning, uscita Lovable |
| ✅ | `docs/glossario.md` | Termini legali e fiscali italiani |
| ✅ | Memoria di progetto sincronizzata | `mem://index.md` + `mem://design/brand` + `mem://process/roadmap` |
| ✅ | **Versioning + Changelog + pagina Novità** | `src/lib/version.ts` + parser `CHANGELOG.md` + route `/novita` autenticata + campanella in topbar. ADR-0008 e guida `docs/guides/versioning-e-release.md` |
| ✅ | **Categorie changelog ridisegnate** | Tre sezioni standard `Novità` / `Correzioni` / `Sotto il cofano`. La pagina `/novita` mette in evidenza le Novità, mantiene compatte le Correzioni e collassa le voci tecniche. Compatibile con voci storiche (Aggiunto/Modificato/Sicurezza) |
| ✅ | **Schema DB su GitHub** | `supabase/schema.sql` baseline + `docs/data-model.md` narrativo + `docs/guides/migrations.md` per il flusso operativo |
| ✅ | **Templates GitHub + Dependabot** | `.github/ISSUE_TEMPLATE/` (bug, idea), `PULL_REQUEST_TEMPLATE.md`, `dependabot.yml` (npm settimanale, minor/patch raggruppati). No GitHub Actions per ora (CI gira via Lovable + hook locale `.githooks/pre-push`) |
| 🟡 | **Guida uscita Lovable** | Piano completo per backend Supabase di proprietà, deploy Vercel e cutover |
| ⬜ | Test minimi su funzioni critiche | XML FatturaPA, calcoli IVA/ritenuta, cassa forense |
| ⬜ | Linter pulito su tutto il repo | `npm run lint` |
| ⬜ | `npm audit --audit-level=moderate` periodico | |

---

## Prossime mosse suggerite (in ordine)

1. **Landing**: pricing, FAQ, mockup prodotto → si gioca qui la conversione.
2. **Empty states + microcopy review** sull'app autenticata → percezione di cura.
3. **Recupero password + esportazione dati** → blocchi minimi prima di pubblicare.
4. **Audit contrasto/accessibilità** in entrambi i temi.
5. **Migrazione fuori da Lovable**: backend proprietario + pubblicazione Vercel.

> Quando completiamo una voce, aggiorniamo lo stato qui e nella memoria di progetto.
