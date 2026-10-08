import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { PasswordlessAccessCard } from "@/components/passwordless-access-card";

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
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center" aria-label="Pratix">
          <Logo form="lockup" size={24} />
        </div>

        <PasswordlessAccessCard
          title="Accesso senza password"
          description="Pratix non usa pi\u00f9 password. Per entrare richiedi un link sicuro e un codice monouso via email dalla pagina di accesso."
          actionLabel="Vai all'accesso"
        />
      </div>
    </div>
  );
}
