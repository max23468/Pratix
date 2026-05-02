import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/brand/logo";
import { z } from "zod";
import { toast } from "sonner";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isTurnstileEnabled } from "@/lib/turnstile";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Registrati · Pratix" },
      { name: "description", content: "Crea un account Pratix gratis." },
      { property: "og:title", content: "Registrati · Pratix" },
      { property: "og:description", content: "Crea un account Pratix gratis." },
    ],
  }),
  component: RegisterPage,
});

const schema = z.object({
  fullName: z.string().trim().min(2, "Inserisci nome e cognome").max(120),
  email: z.string().trim().email("Email non valida").max(255),
  password: z.string().min(8, "Almeno 8 caratteri").max(128),
});

function RegisterPage() {
  const navigate = useNavigate();
  const captchaEnabled = isTurnstileEnabled();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ fullName, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    if (captchaEnabled && !captchaToken) {
      toast.error("Completa la verifica di sicurezza.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.fullName },
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    setSubmitting(false);
    setCaptchaResetSignal((current) => current + 1);
    if (error) {
      // Messaggio generico per evitare user enumeration: non riveliamo se l'email è già registrata
      toast.error("Registrazione non riuscita. Riprova o accedi se hai già un account.");
      return;
    }
    if (!data.session) {
      setConfirmationSent(true);
      toast.success("Account creato. Controlla l'email per confermare l'accesso.");
      return;
    }
    toast.success("Account creato. Procedi con la configurazione della tua professione.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center" aria-label="Pratix">
          <Logo form="lockup" size={24} />
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Crea il tuo account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Bastano pochi secondi per iniziare.</p>
          {confirmationSent ? (
            <div
              className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground"
              role="status"
              aria-live="polite"
            >
              <p className="font-medium">Controlla la tua casella.</p>
              <p className="mt-1 text-muted-foreground">
                Ti abbiamo inviato il link per confermare l'account. Dopo la conferma potrai
                accedere a Pratix.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome e cognome</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <TurnstileChallenge
                action="register"
                onTokenChange={setCaptchaToken}
                resetSignal={captchaResetSignal}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creazione account…" : "Crea account"}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Hai già un account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
