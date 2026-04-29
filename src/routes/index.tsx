import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FileText, Receipt, Wallet, ShieldCheck, ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Pratix — Tutto torna." },
      {
        name: "description",
        content:
          "Pratix è il gestionale per avvocati freelance. Pratiche, scadenze, spese e fatturazione elettronica: ogni cosa al suo posto, ogni conto che torna.",
      },
      { property: "og:title", content: "Pratix — Tutto torna." },
      {
        property: "og:description",
        content:
          "Il gestionale per avvocati freelance. Ogni pratica al suo posto, ogni conto che torna.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="Pratix">
            <Logo form="lockup" size={22} />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Accedi
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Inizia</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
              Per avvocati freelance
            </div>
            <h1 className="font-display mt-7 text-6xl font-semibold tracking-tight text-foreground sm:text-7xl lg:text-[88px] lg:leading-[0.98]">
              Tutto<span className="text-brand-gold">.</span>
              <br />
              torna<span className="text-brand-gold">.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Pratix è il gestionale per avvocati freelance. Pratiche,
              scadenze, spese e fatturazione elettronica: ogni cosa al suo posto,
              ogni conto che torna.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Crea il tuo account
                  <ArrowRight className="ml-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Hai già un account?
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Nessuna carta richiesta · Dati su server europei
            </p>
          </div>

          <div className="mt-24 grid gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-elegant sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileText,
                title: "Pratiche",
                desc: "Stato, parti e note in un solo posto.",
              },
              {
                icon: CalendarClock,
                title: "Scadenze",
                desc: "Mai più una data persa.",
              },
              {
                icon: Wallet,
                title: "Spese",
                desc: "Anticipi e rimborsi pronti per la fattura.",
              },
              {
                icon: Receipt,
                title: "Fatturazione",
                desc: "Calcoli forensi automatici, PDF e XML SdI.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-card p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/5 text-primary">
                  <f.icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                </div>
                <h3 className="font-display mt-5 text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-20 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-soft sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-gold/10 text-brand-gold">
                <ShieldCheck className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <div>
                <p className="font-display text-base font-semibold text-foreground">
                  I tuoi dati restano tuoi.
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Ogni riga è visibile solo a te. Backup automatici, infrastruttura europea.
                </p>
              </div>
            </div>
            <Link to="/register" className="shrink-0">
              <Button variant="gold">Inizia ora</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <Logo form="wordmark" size={16} tone="navy" />
          <span>© {new Date().getFullYear()} Pratix · Pensato in Italia</span>
        </div>
      </footer>
    </div>
  );
}
