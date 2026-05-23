import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthEmailOtpForm } from "@/components/auth-email-otp-form";
import { Logo } from "@/components/brand/logo";
import { toast } from "sonner";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePasskeySupported } from "@/hooks/use-passkey-supported";
import { supabase } from "@/integrations/supabase/client";
import { loginSchema } from "@/lib/auth-schemas";
import { PASSKEYS_ENABLED, passkeysUnavailableMessage } from "@/lib/passkeys";
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
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const passkeySupported = usePasskeySupported();
  const submitLock = useSubmitLock();

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
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          shouldCreateUser: false,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) throw error;
      setPendingEmail(parsed.data.email);
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invio del link non riuscito.");
    } finally {
      setSubmitting(false);
      submitLock.release();
      setCaptchaResetSignal((current) => current + 1);
    }
  };

  const handlePasskeySignIn = async () => {
    if (!PASSKEYS_ENABLED) {
      toast.error(passkeysUnavailableMessage());
      return;
    }
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
            Inserisci la tua email: ti invieremo un link sicuro e un codice monouso.
          </p>
          {sent ? (
            <>
              <output
                className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground"
                aria-live="polite"
              >
                <span className="block font-medium">Controlla la tua casella.</span>
                <span className="mt-1 block text-muted-foreground">
                  Se l'indirizzo è registrato, riceverai a breve un link e un codice monouso. Puoi
                  usare l'uno o l'altro per entrare in Pratix.
                </span>
              </output>
              <AuthEmailOtpForm
                email={pendingEmail}
                onVerified={() => navigate({ to: "/dashboard" })}
              />
            </>
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
                {submitting ? "Invio in corso…" : "Invia link e codice"}
              </Button>
            </form>
          )}

          {PASSKEYS_ENABLED && passkeySupported ? (
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
