import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Scale, FileText, Receipt, Wallet, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Pratix</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Accedi
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Inizia gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-accent/40 px-3 py-1 text-xs font-medium text-accent-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Pensato per avvocati freelance
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Il gestionale semplice per le tue pratiche
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Pratix ti aiuta a tenere sotto controllo lo stato delle pratiche, i rimborsi spese e
              la fatturazione elettronica, senza complicazioni.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Crea il tuo account
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Hai già un account?
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileText,
                title: "Pratiche",
                desc: "Stato, scadenze, controparti e note in un solo posto.",
              },
              {
                icon: Wallet,
                title: "Rimborsi spese",
                desc: "Annota ogni spesa per pratica e portala in fattura.",
              },
              {
                icon: Receipt,
                title: "Fatture",
                desc: "Calcoli forensi automatici, PDF e XML SdI.",
              },
              {
                icon: ShieldCheck,
                title: "Privato",
                desc: "I tuoi dati sono protetti e visibili solo a te.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Pratix
        </div>
      </footer>
    </div>
  );
}
