import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/brand/logo";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recupera-password")({
  head: () => ({
    meta: [
      { title: "Recupera password — Pratix" },
      {
        name: "description",
        content:
          "Hai dimenticato la password di Pratix? Inserisci la tua email e ti invieremo un link per reimpostarla.",
      },
      { property: "og:title", content: "Recupera password — Pratix" },
      {
        property: "og:description",
        content:
          "Hai dimenticato la password di Pratix? Inserisci la tua email e ti invieremo un link per reimpostarla.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().trim().email("Inserisci un'email valida").max(255),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Email non valida");
      return;
    }
    setSubmitting(true);
    // Tentiamo l'invio. Anche in caso di errore mostriamo lo stesso messaggio
    // generico per evitare user enumeration.
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reimposta-password`,
    });
    setSubmitting(false);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center" aria-label="Pratix">
          <Logo form="lockup" size={24} />
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Recupera password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inserisci l'email del tuo account: ti invieremo un link per impostare
            una nuova password.
          </p>

          {sent ? (
            <div
              className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground"
              role="status"
              aria-live="polite"
            >
              <p className="font-medium">Controlla la tua casella.</p>
              <p className="mt-1 text-muted-foreground">
                Se l'indirizzo è registrato, riceverai a breve un'email con il
                link per reimpostare la password. Controlla anche lo spam.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Invio in corso…" : "Invia link di recupero"}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Ti sei ricordato la password?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Torna al login
          </Link>
        </p>
      </div>
    </div>
  );
}
