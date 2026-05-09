import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/termini")({
  head: () => ({
    meta: [
      { title: "Termini di servizio · Pratix" },
      {
        name: "description",
        content:
          "Termini e condizioni d'uso del servizio Pratix, gestionale per avvocati freelance.",
      },
      { property: "og:title", content: "Termini di servizio · Pratix" },
      {
        property: "og:description",
        content:
          "Termini e condizioni d'uso del servizio Pratix, gestionale per avvocati freelance.",
      },
    ],
  }),
  component: TerminiPage,
});

function TerminiPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="Pratix">
            <Logo form="lockup" size={22} />
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Torna alla home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Documento legale</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-foreground">
          Termini di servizio
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Ultimo aggiornamento: 29 aprile 2026 · Versione preliminare
        </p>

        <div
          className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          role="note"
        >
          Questo documento è una bozza preliminare in attesa di revisione legale. Non costituisce
          ancora la versione definitiva dei termini di servizio.
        </div>

        <article className="prose-pratix mt-10 space-y-8 text-[15px] leading-relaxed text-foreground">
          <section>
            <h2 className="font-display text-xl font-semibold">1. Oggetto</h2>
            <p className="mt-2 text-muted-foreground">
              I presenti termini disciplinano l'uso di Pratix, applicazione web destinata agli
              avvocati che esercitano la professione in forma individuale (freelance) per la
              gestione di pratiche di recupero crediti, committenti, clienti, controparti, attività
              fatturabili e fatturazione elettronica.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">2. Account</h2>
            <p className="mt-2 text-muted-foreground">
              L'utente garantisce la veridicità dei dati forniti in fase di registrazione e si
              impegna a custodire le proprie credenziali. È vietato condividere l'account con terzi.
              L'utente è responsabile delle attività compiute tramite il proprio account.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">3. Uso consentito</h2>
            <p className="mt-2 text-muted-foreground">
              Pratix può essere usato esclusivamente per finalità lecite e nel rispetto della
              normativa applicabile. Sono vietati: l'accesso automatizzato non autorizzato, il
              reverse engineering, l'utilizzo per scopi diversi dalla gestione della propria
              professione.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">4. Contenuti dell'utente</h2>
            <p className="mt-2 text-muted-foreground">
              I dati e i contenuti inseriti dall'utente (committenti, clienti, controparti,
              pratiche, attività, fatture, allegati) restano di proprietà dell'utente. Pratix li
              tratta nei limiti necessari all'erogazione del servizio, come descritto nell'
              <Link to="/privacy" className="font-medium text-primary underline underline-offset-4">
                Informativa sulla privacy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">5. Disponibilità del servizio</h2>
            <p className="mt-2 text-muted-foreground">
              Pratix è erogato in modalità SaaS e viene mantenuto con la massima diligenza. Possono
              verificarsi interruzioni per manutenzione, aggiornamenti o cause di forza maggiore.
              Nei limiti consentiti dalla legge, non è garantita la continuità ininterrotta del
              servizio.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">6. Limiti di responsabilità</h2>
            <p className="mt-2 text-muted-foreground">
              Pratix fornisce strumenti di supporto alla gestione amministrativa della professione.
              Non sostituisce il commercialista, l'intermediario abilitato all'invio SDI, né la
              consulenza legale o fiscale. La responsabilità sui contenuti delle fatture, sulla
              numerazione, sui calcoli e sull'invio rimane in capo all'utente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">7. Recesso</h2>
            <p className="mt-2 text-muted-foreground">
              L'utente può recedere in qualsiasi momento richiedendo la cancellazione del proprio
              account. I dati saranno cancellati nei termini previsti dall'
              <Link to="/privacy" className="font-medium text-primary underline underline-offset-4">
                Informativa sulla privacy
              </Link>
              , fatti salvi gli obblighi di conservazione di legge.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">8. Modifiche ai termini</h2>
            <p className="mt-2 text-muted-foreground">
              Pratix può aggiornare i presenti termini per esigenze normative, tecniche o di
              servizio. Le modifiche significative saranno comunicate via email o tramite avviso in
              app.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">9. Legge applicabile e foro</h2>
            <p className="mt-2 text-muted-foreground">
              I presenti termini sono regolati dalla legge italiana. Per ogni controversia è
              competente il foro del luogo di residenza del consumatore, ove applicabile, oppure il
              foro indicato negli estremi di contatto.
            </p>
          </section>
        </article>

        <div className="mt-12 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="font-medium text-primary underline underline-offset-4">
            Leggi l'Informativa sulla privacy
          </Link>
          <span>·</span>
          <Link to="/" className="font-medium text-primary underline underline-offset-4">
            Torna alla home
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-6 text-xs text-muted-foreground">
          <Logo form="wordmark" size={16} tone="navy" />
          <span>© 2026 Pratix</span>
        </div>
      </footer>
    </div>
  );
}
