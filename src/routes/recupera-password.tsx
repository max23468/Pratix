import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { PasswordlessAccessCard } from "@/components/passwordless-access-card";

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
        <Link to="/" className="mb-8 flex items-center justify-center">
          <Logo form="lockup" size={24} />
        </Link>

        <PasswordlessAccessCard
          title="Accesso via email"
          description="Non c'\u00e8 una password da recuperare: inserisci la tua email nella pagina di accesso e riceverai un link sicuro e un codice monouso."
          actionLabel="Richiedi link e codice"
        />
      </div>
    </div>
  );
}
