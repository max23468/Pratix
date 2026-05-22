import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reimposta-password")({
  head: () => ({
    meta: [
      { title: "Accesso senza password · Pratix" },
      {
        name: "description",
        content: "Pratix usa link di accesso e codici monouso via email al posto della password.",
      },
      { property: "og:title", content: "Accesso senza password · Pratix" },
      {
        property: "og:description",
        content: "Pratix usa link di accesso e codici monouso via email al posto della password.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PasswordlessNoticePage,
});

function PasswordlessNoticePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center" aria-label="Pratix">
          <Logo form="lockup" size={24} />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Accesso senza password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pratix non usa più password. Per entrare richiedi un link sicuro e un codice monouso via
            email dalla pagina di accesso.
          </p>
          <div className="mt-6">
            <Button asChild className="w-full">
              <Link to="/login">Vai all'accesso</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
