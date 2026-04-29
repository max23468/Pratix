import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Informativa sulla privacy — Pratix" },
      {
        name: "description",
        content:
          "Come Pratix tratta i dati personali degli avvocati che usano il servizio e dei loro clienti, ai sensi del GDPR.",
      },
      { property: "og:title", content: "Informativa sulla privacy — Pratix" },
      {
        property: "og:description",
        content:
          "Come Pratix tratta i dati personali degli avvocati e dei loro clienti, ai sensi del GDPR.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="Pratix">
            <Logo form="lockup" size={22} />
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Torna alla home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Documento legale
        </p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-foreground">
          Informativa sulla privacy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Ultimo aggiornamento: 29 aprile 2026 · Versione preliminare
        </p>

        <div
          className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          role="note"
        >
          Questo documento è una bozza preliminare in attesa di revisione legale.
          Non costituisce ancora la versione definitiva dell'informativa.
        </div>

        <article className="prose-pratix mt-10 space-y-8 text-[15px] leading-relaxed text-foreground">
          <section>
            <h2 className="font-display text-xl font-semibold">1. Titolare del trattamento</h2>
            <p className="mt-2 text-muted-foreground">
              Titolare del trattamento dei dati personali è il gestore del servizio
              Pratix. Per esercitare i tuoi diritti puoi contattarci all'indirizzo
              email indicato in fondo a questo documento.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">2. Dati che trattiamo</h2>
            <p className="mt-2 text-muted-foreground">
              Pratix tratta due categorie di dati: i dati dell'avvocato che usa il
              servizio (anagrafica, partita IVA, codice fiscale, dati fiscali,
              email, recapiti, credenziali di accesso) e i dati dei clienti che
              l'avvocato sceglie di registrare nel sistema (anagrafica, recapiti,
              dati fiscali, contenuti delle pratiche, fatture).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">3. Finalità del trattamento</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
              <li>Erogazione del servizio gestionale.</li>
              <li>Generazione di fatture elettroniche conformi a FatturaPA.</li>
              <li>Sicurezza dell'account e prevenzione abusi.</li>
              <li>Adempimenti contabili e fiscali a carico del gestore.</li>
              <li>
                Comunicazioni di servizio (es. recupero password, notifiche di
                sistema).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">
              4. Base giuridica e ruoli
            </h2>
            <p className="mt-2 text-muted-foreground">
              Il trattamento dei dati dell'avvocato avviene sulla base del contratto
              di servizio. I dati dei clienti finali sono trattati da Pratix in
              qualità di responsabile del trattamento, mentre l'avvocato resta
              titolare autonomo del trattamento nei confronti dei propri clienti
              ai sensi del GDPR.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">5. Conservazione</h2>
            <p className="mt-2 text-muted-foreground">
              I dati sono conservati per la durata del rapporto contrattuale e per
              il tempo necessario ad adempiere a obblighi legali, fiscali e
              difensivi. L'utente può richiedere in qualsiasi momento la
              cancellazione dell'account e dei dati associati.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">
              6. Sicurezza e localizzazione
            </h2>
            <p className="mt-2 text-muted-foreground">
              I dati sono ospitati su infrastruttura cloud europea con cifratura in
              transito e a riposo. L'accesso ai dati di ciascun utente è limitato
              tramite policy di sicurezza a livello di riga: ogni utente vede solo
              i propri dati.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">7. Diritti dell'utente</h2>
            <p className="mt-2 text-muted-foreground">
              Hai il diritto di accedere ai tuoi dati, rettificarli, chiederne la
              cancellazione, opporti al trattamento, richiedere la portabilità e
              proporre reclamo all'autorità di controllo (Garante per la protezione
              dei dati personali).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">8. Contatti</h2>
            <p className="mt-2 text-muted-foreground">
              Per ogni richiesta scrivi all'indirizzo email del gestore del
              servizio, indicato negli estremi di contatto.
            </p>
          </section>
        </article>

        <div className="mt-12 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link to="/termini" className="font-medium text-primary hover:underline">
            Leggi i Termini di servizio
          </Link>
          <span>·</span>
          <Link to="/" className="font-medium text-primary hover:underline">
            Torna alla home
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <Logo form="wordmark" size={16} tone="navy" />
          <span>© {new Date().getFullYear()} Pratix</span>
        </div>
      </footer>
    </div>
  );
}
