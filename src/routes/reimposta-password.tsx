import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/brand/logo";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reimposta-password")({
  head: () => ({
    meta: [
      { title: "Reimposta password · Pratix" },
      {
        name: "description",
        content: "Imposta una nuova password per il tuo account Pratix.",
      },
      { property: "og:title", content: "Reimposta password · Pratix" },
      {
        property: "og:description",
        content: "Imposta una nuova password per il tuo account Pratix.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, "Almeno 8 caratteri").max(128),
    confirm: z.string().min(8, "Almeno 8 caratteri").max(128),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Le password non coincidono",
    path: ["confirm"],
  });

function getPasswordUpdateErrorMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("different") ||
    normalized.includes("same password") ||
    normalized.includes("new password")
  ) {
    return "La nuova password deve essere diversa da quella attuale.";
  }

  return "Impossibile aggiornare la password. Richiedi un nuovo link di recupero.";
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Quando l'utente arriva dal link email, Supabase imposta una sessione di
  // recovery. Aspettiamo che sia pronta prima di mostrare il form.
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (!error) {
          setLinkError(null);
          setReady(true);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session) {
          setLinkError(null);
          setReady(true);
          return;
        }
        setLinkError("Il link di recupero non è valido o è scaduto.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setLinkError(null);
        setReady(true);
        return;
      }
      setLinkError("Apri il link ricevuto via email o richiedine uno nuovo.");
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setLinkError(null);
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(getPasswordUpdateErrorMessage(error.message));
      return;
    }
    toast.success("Password aggiornata. Accedi con le nuove credenziali.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center" aria-label="Pratix">
          <Logo form="lockup" size={24} />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Reimposta password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scegli una nuova password per il tuo account.
          </p>

          {linkError ? (
            <div
              className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground"
              role="status"
              aria-live="polite"
            >
              <p className="font-medium">Link non valido.</p>
              <p className="mt-1 text-muted-foreground">{linkError}</p>
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link to="/recupera-password">Richiedi un nuovo link</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">Torna al login</Link>
                </Button>
              </div>
            </div>
          ) : !ready ? (
            <p className="mt-6 text-sm text-muted-foreground" role="status" aria-live="polite">
              Verifica del link in corso…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nuova password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Conferma password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Aggiornamento…" : "Aggiorna password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
