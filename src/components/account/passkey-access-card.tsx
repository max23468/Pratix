import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePasskeySupported } from "@/hooks/use-passkey-supported";
import { supabase } from "@/integrations/supabase/client";
import { PASSKEYS_ENABLED, passkeysUnavailableMessage } from "@/lib/passkeys";
import { useSubmitLock } from "@/lib/submit-lock";

type PasskeyListItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

export function PasskeyAccessCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const submitLock = useSubmitLock();
  const passkeySupported = usePasskeySupported();

  const {
    data: passkeys = [],
    isError: passkeyListFailed,
    isLoading,
  } = useQuery({
    queryKey: ["account-passkeys", userId],
    enabled: PASSKEYS_ENABLED && !!userId && passkeySupported,
    queryFn: async () => {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      return data as PasskeyListItem[];
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!PASSKEYS_ENABLED) throw new Error(passkeysUnavailableMessage());
      if (!passkeySupported)
        throw new Error("Le passkey non sono disponibili su questo dispositivo");
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Passkey aggiunta");
      qc.invalidateQueries({ queryKey: ["account-passkeys", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: submitLock.release,
  });

  const deleteMutation = useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await supabase.auth.passkey.delete({ passkeyId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Passkey rimossa");
      qc.invalidateQueries({ queryKey: ["account-passkeys", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="size-4 text-muted-foreground" />
          Passkey
        </CardTitle>
        <CardDescription>
          Aggiungi una passkey per accedere più velocemente dal dispositivo che stai usando.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!PASSKEYS_ENABLED ? (
          <p className="text-sm text-muted-foreground">{passkeysUnavailableMessage()}</p>
        ) : passkeySupported ? (
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento passkey…</p>
            ) : passkeyListFailed ? (
              <p className="text-sm text-muted-foreground">
                Non è stato possibile caricare le passkey. Puoi continuare a usare il link via
                email.
              </p>
            ) : passkeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessuna passkey collegata a questo account.
              </p>
            ) : (
              <div className="space-y-2">
                {passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {passkey.friendly_name || "Passkey"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Aggiunta il{" "}
                        {new Date(passkey.created_at).toLocaleDateString("it-IT", {
                          timeZone: "Europe/Rome",
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(passkey.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Rimuovi
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Le passkey non sono disponibili su questo dispositivo o browser.
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (submitLock.acquire()) registerMutation.mutate();
            }}
            disabled={!PASSKEYS_ENABLED || !passkeySupported || registerMutation.isPending}
          >
            {registerMutation.isPending ? "Aggiunta…" : "Aggiungi passkey"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
