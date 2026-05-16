import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  FileArchive,
  FileUp,
  Fingerprint,
  MailCheck,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AppearanceCard } from "@/components/appearance-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PASSKEYS_ENABLED, passkeysUnavailableMessage } from "@/lib/passkeys";
import {
  buildPersonalDataCsvArchive,
  buildPersonalDataJson,
  PERSONAL_DATA_TABLES,
  type PersonalDataTable,
  type PersonalDataPayload,
} from "@/lib/personal-data-export";
import { APP_VERSION, BUILD_DATE } from "@/lib/version";
import { downloadBytes } from "@/lib/invoice-file-exports";
import { useSubmitLock } from "@/lib/submit-lock";
import { deleteAccountFn } from "@/server/account.functions";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account · Pratix" },
      {
        name: "description",
        content: "Profilo, accesso, sicurezza e aspetto del tuo account Pratix.",
      },
      { property: "og:title", content: "Account · Pratix" },
      {
        property: "og:description",
        content: "Profilo, accesso, sicurezza e aspetto del tuo account Pratix.",
      },
    ],
  }),
  component: AccountPage,
});

type ProfileForm = {
  full_name: string;
  email: string;
  phone: string;
};

type DeleteAccountResult = {
  deleted: boolean;
  removedStorageObjects: number;
};

type PasskeyListItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

const unwrapServerResult = <T,>(result: T | { data: T }) =>
  "data" in Object(result) ? (result as { data: T }).data : (result as T);

const readServerResult = async <T,>(result: T | { data: T } | Response) => {
  if (result instanceof Response) {
    if (!result.ok) throw new Error(await result.text());
    const contentType = result.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return unwrapServerResult<T>(await result.json());
    }
    throw new Error("Risposta server non valida");
  }
  return unwrapServerResult<T>(result);
};

function AccountPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>({ full_name: "", email: "", phone: "" });
  const saveLock = useSubmitLock();

  const { data, isLoading } = useQuery({
    queryKey: ["profile-account", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      full_name: data.full_name ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profilo aggiornato");
      qc.invalidateQueries({ queryKey: ["profile-account"] });
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile-full"] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: saveLock.release,
  });

  return (
    <AppLayout>
      <PageHeader
        title="Account"
        description="Profilo, accesso, sicurezza e preferenze personali del professionista."
      />

      <Tabs defaultValue="profilo" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="profilo">Profilo</TabsTrigger>
          <TabsTrigger value="sicurezza">Accesso e sicurezza</TabsTrigger>
          <TabsTrigger value="aspetto">Aspetto</TabsTrigger>
          <TabsTrigger value="notifiche">Notifiche</TabsTrigger>
          <TabsTrigger value="dati">Dati</TabsTrigger>
        </TabsList>

        <TabsContent value="profilo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informazioni personali</CardTitle>
              <CardDescription>
                Come ti chiami e dove ti contattiamo. Per i dati di fatturazione vai a{" "}
                <Link to="/impostazioni" className="underline-offset-2 hover:underline">
                  Impostazioni
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-full-name">Nome e cognome</Label>
                <Input
                  id="profile-full-name"
                  value={form.full_name}
                  onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-contact-email">Email di contatto</Label>
                <Input
                  id="profile-contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Diversa dall'email di accesso: usata su fatture e comunicazioni con i clienti.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Telefono</Label>
                <Input
                  id="profile-phone"
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (saveLock.acquire()) saveMutation.mutate();
              }}
              disabled={saveMutation.isPending || isLoading}
            >
              <Save className="mr-2 size-4" />
              {saveMutation.isPending ? "Salvataggio…" : "Salva profilo"}
            </Button>
          </div>

          <div className="mt-8 flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Pratix <span className="font-mono">v{APP_VERSION}</span>
              <span className="mx-1.5">·</span>
              build {BUILD_DATE}
            </span>
            <Link to="/novita" className="underline-offset-2 hover:underline">
              Cosa è cambiato
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="sicurezza" className="space-y-4">
          <EmailAccessCard email={user?.email ?? ""} />
          <PasskeyAccessCard userId={user?.id ?? ""} />
        </TabsContent>

        <TabsContent value="aspetto" className="space-y-4">
          <AppearanceCard />
        </TabsContent>

        <TabsContent value="notifiche" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifiche</CardTitle>
              <CardDescription>
                Le notifiche di prodotto sono già attive: vedi un pallino sulla campanella in alto
                quando esce una nuova versione di Pratix.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                In futuro qui potrai gestire promemoria via email per fatture e aggiornamenti
                importanti.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dati" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="size-4 text-muted-foreground" />
                Import archivio
              </CardTitle>
              <CardDescription>
                Trascrivi pratiche da archivio cartaceo o importa un Excel strutturato.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link to="/import-archivio">Apri import archivio</Link>
              </Button>
            </CardContent>
          </Card>

          <DataExportCard />

          <DeleteAccountCard
            email={user?.email ?? ""}
            onDeleted={async () => {
              qc.clear();
              await supabase.auth.signOut().catch(() => undefined);
              navigate({ to: "/" });
            }}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function DataExportCard() {
  const fetchTableRows = async (table: PersonalDataTable) => {
    const pageSize = 1000;
    const rows: unknown[] = [];

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;

      const page = (data ?? []) as unknown[];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  };

  const buildPayload = async (): Promise<PersonalDataPayload> => {
    const entries = await Promise.all(
      PERSONAL_DATA_TABLES.map(async (table) => {
        return [table, await fetchTableRows(table)] as const;
      }),
    );

    return {
      exportedAt: new Date().toISOString(),
      product: "Pratix",
      tables: Object.fromEntries(entries),
    };
  };

  const exportMutation = useMutation({
    mutationFn: async (format: "json" | "csv") => {
      const payload = await buildPayload();
      const date = new Date().toISOString().slice(0, 10);

      if (format === "json") {
        const file = buildPersonalDataJson(payload);
        downloadBytes({
          bytes: file.bytes,
          fileName: `pratix-export-dati-${date}.json`,
          mimeType: file.mimeType,
        });
        return "json";
      }

      const archive = buildPersonalDataCsvArchive(payload);
      downloadBytes({
        bytes: archive.bytes,
        fileName: `pratix-export-dati-${date}.zip`,
        mimeType: archive.mimeType,
      });
      return "csv";
    },
    onSuccess: (format) =>
      toast.success(format === "json" ? "Export JSON generato" : "Archivio CSV generato"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="size-4 text-muted-foreground" />
          Export dati
        </CardTitle>
        <CardDescription>
          Scarica una copia dei dati personali e operativi in formato JSON o CSV.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate("json")}
          disabled={exportMutation.isPending}
        >
          <Download className="mr-2 size-4" />
          {exportMutation.isPending ? "Preparazione…" : "Scarica JSON"}
        </Button>
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate("csv")}
          disabled={exportMutation.isPending}
        >
          <FileArchive className="mr-2 size-4" />
          {exportMutation.isPending ? "Preparazione…" : "Scarica CSV"}
        </Button>
      </CardContent>
    </Card>
  );
}

function EmailAccessCard({ email }: { email: string }) {
  const [nextEmail, setNextEmail] = useState(email);
  const submitLock = useSubmitLock();

  useEffect(() => setNextEmail(email), [email]);

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
    onSuccess: () => {
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
            onChange={(event) => setNextEmail(event.target.value)}
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

function PasskeyAccessCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const submitLock = useSubmitLock();
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    setPasskeySupported("PublicKeyCredential" in window);
  }, []);

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
                Passkey non disponibili per questo progetto Supabase. Puoi continuare a usare il
                link via email.
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
                        Aggiunta il {new Date(passkey.created_at).toLocaleDateString("it-IT")}
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

function DeleteAccountCard({
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
