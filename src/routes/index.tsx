import { useEffect } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;

    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Pratix · Tutto torna." },
      {
        name: "description",
        content:
          "Pratix è il gestionale per avvocati freelance che seguono recupero crediti: committenti, clienti, controparti, attività e fatturazione.",
      },
      { property: "og:title", content: "Pratix · Tutto torna." },
      {
        property: "og:description",
        content: "Il gestionale per avvocati freelance che seguono recupero crediti.",
      },
      { name: "twitter:title", content: "Pratix · Tutto torna." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, navigate, session]);

  if (loading || session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Caricamento…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" aria-label="Pratix">
            <Logo form="lockup" size={30} />
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
        <section className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Link to="/" aria-label="Pratix" className="inline-flex">
              <Logo form="mark" size={88} />
            </Link>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="size-1.5 rounded-full bg-brand-gold" />
              Per avvocati freelance
            </div>
            <h1 className="font-display mt-6 text-6xl font-semibold tracking-tight text-foreground sm:text-7xl lg:text-[88px] lg:leading-[0.98]">
              Tutto<span className="text-brand-gold">.</span>
              <br />
              torna<span className="text-brand-gold">.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Pratix è il gestionale per avvocati freelance che seguono recupero crediti:
              committenti, clienti, controparti, attività e fatturazione.
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

          <div className="mt-24 grid gap-px overflow-hidden rounded-lg border border-border bg-border shadow-elegant sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Building2,
                title: "Committenti",
                desc: "Prezzi, clienti collegati e regole economiche.",
              },
              {
                icon: FileText,
                title: "Pratiche",
                desc: "Committente, cliente e controparte in un solo posto.",
              },
              {
                icon: ListChecks,
                title: "Attività",
                desc: "Compensi e rimborsi pronti per la fattura.",
              },
              {
                icon: Receipt,
                title: "Fatturazione",
                desc: "Calcoli forensi automatici, PDF e XML SdI.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-card p-6">
                <div className="flex size-9 items-center justify-center rounded-md bg-primary/5 text-primary">
                  <f.icon className="size-4.5" strokeWidth={1.6} />
                </div>
                <h3 className="font-display mt-5 text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>

          <section className="mt-20 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-brand-gold">Perché Pratix</p>
              <h2 className="font-display mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
                Recupero crediti, senza rumore di fondo.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Pratix tiene insieme committente, cliente, controparte, attività e fattura. Lavori
                sulle righe che ti servono, poi produci PDF, XML SdI e Rendiconto Excel.
              </p>
              <div className="mt-6 grid gap-3">
                {[
                  "Pratiche numerate e collegate ai soggetti corretti.",
                  "Compensi e rimborsi pronti per la fatturazione.",
                  "Esportazioni coerenti con il lavoro svolto.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-gold" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <ProductMockup />
          </section>

          <section className="mt-20 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ListChecks,
                title: "Operatività",
                desc: "Attività, stati e import archivio restano dentro lo stesso flusso.",
              },
              {
                icon: Receipt,
                title: "Fatturazione",
                desc: "Il maturato per committente diventa fattura con rendiconti scaricabili.",
              },
              {
                icon: FileSpreadsheet,
                title: "Dati esportabili",
                desc: "Archivio personale, fatture e rendiconti non restano chiusi nella UI.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-border bg-card p-6 shadow-soft"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-primary/5 text-primary">
                  <item.icon className="size-4.5" strokeWidth={1.6} />
                </div>
                <h3 className="font-display mt-5 text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </section>

          <section
            id="pricing"
            className="mt-20 rounded-lg border border-border bg-card p-8 shadow-soft"
          >
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase text-brand-gold">Pricing</p>
                <h2 className="font-display mt-3 text-3xl font-semibold text-foreground">
                  Gratis nella fase iniziale.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Puoi provare Pratix senza carta. Il piano a pagamento sarà definito prima
                  dell'apertura commerciale, con prezzo chiaro e senza moduli superflui.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Account personale",
                  "Pratiche e attività",
                  "Fatture PDF e XML",
                  "Rendiconto Excel",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="size-4 shrink-0 text-brand-gold" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="faq" className="mt-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-brand-gold">FAQ</p>
              <h2 className="font-display mt-3 text-3xl font-semibold text-foreground">
                Domande frequenti.
              </h2>
            </div>
            <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
              {[
                {
                  q: "Pratix sostituisce la contabilità?",
                  a: "No. Pratix aiuta a ordinare pratiche, attività e fatture. La contabilità resta al professionista o al consulente.",
                },
                {
                  q: "Posso usare Pratix per recupero crediti?",
                  a: "Sì. Il flusso è pensato per committenti, clienti, controparti, compensi, rimborsi spese e rendiconti.",
                },
                {
                  q: "I dati sono esportabili?",
                  a: "Sì. Puoi esportare dati personali, fatture PDF/XML e Rendiconti Excel.",
                },
                {
                  q: "Serve una carta per iniziare?",
                  a: "No. La fase iniziale non richiede carta di pagamento.",
                },
              ].map((item) => (
                <div key={item.q} className="bg-card p-6">
                  <h3 className="text-sm font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-20 flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-soft sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-gold/10 text-brand-gold">
                <ShieldCheck className="size-5" strokeWidth={1.6} />
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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo form="wordmark" size={18} tone="navy" />
            <span className="hidden text-muted-foreground sm:inline">·</span>
            <span className="hidden italic sm:inline">Tutto torna.</span>
          </div>
          <nav aria-label="Documenti legali" className="flex flex-wrap items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground hover:underline">
              Privacy
            </Link>
            <Link to="/termini" className="hover:text-foreground hover:underline">
              Termini
            </Link>
            <span className="text-muted-foreground">© 2026 Pratix · Pensato in Italia</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function ProductMockup() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card shadow-elegant"
      aria-label="Anteprima Pratix"
    >
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-brand-gold" />
            <span className="text-xs font-medium text-muted-foreground">Pratica 5093212</span>
          </div>
          <span className="rounded-md bg-primary/5 px-2 py-1 text-xs font-medium text-primary">
            Da fatturare
          </span>
        </div>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 bg-card p-5">
          <div>
            <p className="text-xs text-muted-foreground">Committente</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Recuperi Italia S.p.A.</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="mt-1 text-sm font-semibold text-foreground">A. Bianchi</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Controparte</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Nord Servizi S.r.l.</p>
          </div>
        </div>
        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Attività</p>
            <p className="text-xs font-medium text-brand-gold">1.248,00 €</p>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["Diffida stragiudiziale", "Compenso", "420,00 €"],
              ["Udienza", "Compenso", "780,00 €"],
              ["Notifica", "Rimborso spese", "48,00 €"],
            ].map(([name, kind, amount]) => (
              <div key={name} className="rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {amount}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{kind}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
