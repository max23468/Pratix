import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/recupera-password")({
  head: () => ({
    meta: [
      { title: "Accesso via email · Pratix" },
      {
        name: "description",
        content:
          "Richiedi un link di accesso e un codice monouso per entrare in Pratix senza password.",
      },
      { property: "og:title", content: "Accesso via email · Pratix" },
      {
        property: "og:description",
        content:
          "Richiedi un link di accesso e un codice monouso per entrare in Pratix senza password.",
      },
    ],
  }),
  component: EmailAccessInfoPage,
});

function EmailAccessInfoPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center" aria-label="Pratix">
          <Logo form="lockup" size={24} />
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          <h1 className="font-display text-2xl font-semibold text-foreground">Accesso via email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Non c'è una password da recuperare: inserisci la tua email nella pagina di accesso e
            riceverai un link sicuro e un codice monouso.
          </p>
          <div className="mt-6">
            <Button asChild className="w-full">
              <Link to="/login">Richiedi link e codice</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
