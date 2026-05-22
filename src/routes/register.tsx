import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthEmailOtpForm } from "@/components/auth-email-otp-form";
import { Logo } from "@/components/brand/logo";
import { toast } from "sonner";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { registerSchema } from "@/lib/auth-schemas";
import { useSubmitLock } from "@/lib/submit-lock";
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

function RegisterPage() {
  const navigate = useNavigate();
  const captchaEnabled = isTurnstileEnabled();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const submitLock = useSubmitLock();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse({ fullName, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    if (captchaEnabled && !captchaToken) {
      toast.error("Completa la verifica di sicurezza.");
      return;
    }
    if (!submitLock.acquire()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: parsed.data.fullName },
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) {
        // Messaggio generico per evitare user enumeration: non riveliamo se l'email è già registrata
        toast.error("Invio non riuscito. Riprova tra poco o accedi se hai già un account.");
        return;
      }
      setPendingEmail(parsed.data.email);
      setConfirmationSent(true);
      toast.success("Link e codice inviati. Controlla l'email per entrare in Pratix.");
    } finally {
      setSubmitting(false);
      submitLock.release();
      setCaptchaResetSignal((current) => current + 1);
    }
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
            <>
              <div
                className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground"
                role="status"
                aria-live="polite"
              >
                <p className="font-medium">Controlla la tua casella.</p>
                <p className="mt-1 text-muted-foreground">
                  Ti abbiamo inviato un link e un codice monouso. Puoi usare l'uno o l'altro per
                  entrare in Pratix.
                </p>
              </div>
              <AuthEmailOtpForm
                email={pendingEmail}
                onVerified={() => navigate({ to: "/dashboard" })}
              />
            </>
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
              <TurnstileChallenge
                action="register"
                onTokenChange={setCaptchaToken}
                resetSignal={captchaResetSignal}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Invio in corso…" : "Invia link e codice"}
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
