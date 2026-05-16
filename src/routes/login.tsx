import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/brand/logo";
import { toast } from "sonner";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { loginSchema } from "@/lib/auth-schemas";
import { useSubmitLock } from "@/lib/submit-lock";
import { isTurnstileEnabled } from "@/lib/turnstile";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi · Pratix" },
      { name: "description", content: "Accedi al tuo account Pratix." },
      { property: "og:title", content: "Accedi · Pratix" },
      { property: "og:description", content: "Accedi al tuo account Pratix." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const captchaEnabled = isTurnstileEnabled();
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [passkeySubmitting, setPasskeySubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const submitLock = useSubmitLock();

  useEffect(() => {
    setPasskeySupported("PublicKeyCredential" in window);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email });
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
      await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          shouldCreateUser: false,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      setSent(true);
    } finally {
      setSubmitting(false);
      submitLock.release();
      setCaptchaResetSignal((current) => current + 1);
    }
  };

  const handlePasskeySignIn = async () => {
    if (!passkeySupported) {
      toast.error("Le passkey non sono disponibili su questo dispositivo.");
      return;
    }
    if (captchaEnabled && !captchaToken) {
      toast.error("Completa la verifica di sicurezza.");
      return;
    }
    setPasskeySubmitting(true);
    const { error } = await supabase.auth.signInWithPasskey(
      captchaToken ? { options: { captchaToken } } : undefined,
    );
    setPasskeySubmitting(false);
    if (error) {
      toast.error("Accesso con passkey non riuscito. Usa il link via email.");
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center" aria-label="Pratix">
          <Logo form="lockup" size={30} />
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          <h1 className="font-display text-2xl font-semibold text-foreground">Accedi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inserisci la tua email: ti invieremo un link sicuro per entrare.
          </p>
          {sent ? (
            <div
              className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground"
              role="status"
              aria-live="polite"
            >
              <p className="font-medium">Controlla la tua casella.</p>
              <p className="mt-1 text-muted-foreground">
                Se l'indirizzo è registrato, riceverai a breve il link per accedere a Pratix.
                Controlla anche lo spam.
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
              <TurnstileChallenge
                action="login"
                onTokenChange={setCaptchaToken}
                resetSignal={captchaResetSignal}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Invio in corso…" : "Invia link di accesso"}
              </Button>
            </form>
          )}

          {passkeySupported ? (
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handlePasskeySignIn}
                disabled={passkeySubmitting}
              >
                {passkeySubmitting ? "Verifica passkey…" : "Accedi con passkey"}
              </Button>
            </div>
          ) : null}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Non hai un account?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
