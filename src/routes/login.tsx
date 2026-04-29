import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/brand/logo";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi — Pratix" },
      { name: "description", content: "Accedi al tuo account Pratix." },
      { property: "og:title", content: "Accedi — Pratix" },
      { property: "og:description", content: "Accedi al tuo account Pratix." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Inserisci un'email valida").max(255),
  password: z.string().min(6, "Almeno 6 caratteri").max(128),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setSubmitting(false);
    if (error) {
      toast.error("Credenziali non valide");
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center" aria-label="Pratix">
          <Logo form="lockup" size={24} />
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          <h1 className="font-display text-2xl font-semibold text-foreground">Accedi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inserisci le tue credenziali per continuare.
          </p>
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Accesso in corso…" : "Accedi"}
            </Button>
            <div className="text-center">
              <Link
                to="/recupera-password"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Password dimenticata?
              </Link>
            </div>
          </form>
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
