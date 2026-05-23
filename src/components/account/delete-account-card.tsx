import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { readServerResult } from "@/lib/server-functions";
import { useSubmitLock } from "@/lib/submit-lock";
import { deleteAccountFn } from "@/server/account.functions";

type DeleteAccountResult = {
  deleted: boolean;
  removedStorageObjects: number;
};

export function DeleteAccountCard({
  email,
  onDeleted,
}: {
  email: string;
  onDeleted: () => Promise<void>;
}) {
  const deleteAccount = useServerFn(deleteAccountFn);
  const [confirmation, setConfirmation] = useState("");
  const submitLock = useSubmitLock();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!email) throw new Error("Email mancante");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessione non valida. Accedi di nuovo.");

      const result = await deleteAccount({
        data: { confirmation },
        headers: { Authorization: `Bearer ${token}` },
      });
      return readServerResult<DeleteAccountResult>(result);
    },
    onSuccess: async () => {
      toast.success("Account eliminato");
      await onDeleted();
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: submitLock.release,
  });

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="size-4 text-destructive" />
          Eliminazione account
        </CardTitle>
        <CardDescription>
          Elimina account, dati applicativi e oggetti Storage collegati. L'operazione non è
          reversibile.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="delete-account-confirmation">Conferma scrivendo ELIMINA</Label>
          <Input
            id="delete-account-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={mutation.isPending || confirmation !== "ELIMINA"}
              >
                <Trash2 className="mr-2 size-4" />
                {mutation.isPending ? "Eliminazione…" : "Elimina account"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare definitivamente l'account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Verranno rimossi l'utente Supabase, i dati di Pratix e gli allegati nel bucket
                  privato. Prima di procedere scarica un export dati se ti serve una copia.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (submitLock.acquire()) mutation.mutate();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Elimina definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
