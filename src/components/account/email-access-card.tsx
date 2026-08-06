import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSubmitLock } from "@/lib/submit-lock";

export function EmailAccessCard({ email }: { email: string }) {
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const nextEmail = draftEmail ?? email;
  const submitLock = useSubmitLock();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanedEmail = nextEmail.trim().toLowerCase();
      if (!email) throw new Error("Email attuale mancante");
      if (!cleanedEmail || !cleanedEmail.includes("@"))
        throw new Error("Inserisci una email valida");
      if (cleanedEmail === email.toLowerCase())
        throw new Error("La nuova email coincide con quella attuale");

      const { error } = await supabase.auth.updateUser({ email: cleanedEmail });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Controlla la nuova email per confermare la modifica");
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: submitLock.release,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Email di accesso
        </CardTitle>
        <CardDescription>
          Cambia l'indirizzo usato per ricevere i link di accesso. Supabase invia una conferma alla
          nuova email.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="account-next-email">Nuova email</Label>
          <Input
            id="account-next-email"
            type="email"
            value={nextEmail}
            onChange={(event) => setDraftEmail(event.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (submitLock.acquire()) mutation.mutate();
            }}
            disabled={mutation.isPending || !nextEmail}
          >
            <MailCheck className="mr-2 size-4" />
            {mutation.isPending ? "Invio conferma…" : "Cambia email"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
