import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  FileArchive,
  FileUp,
  KeyRound,
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
import {
  buildPersonalDataCsvArchive,
  buildPersonalDataJson,
  PERSONAL_DATA_TABLES,
  type PersonalDataTable,
  type PersonalDataPayload,
} from "@/lib/personal-data-export";
import { APP_VERSION, BUILD_DATE } from "@/lib/version";
import { downloadBytes } from "@/lib/invoice-file-exports";
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
                <Label>Nome e cognome</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email di contatto</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Diversa dall'email di accesso: usata su fatture e comunicazioni con i clienti.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Telefono</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
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
          <ChangePasswordCard email={user?.email ?? ""} />
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
  const [currentPassword, setCurrentPassword] = useState("");

  useEffect(() => setNextEmail(email), [email]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanedEmail = nextEmail.trim().toLowerCase();
      if (!email) throw new Error("Email attuale mancante");
      if (!cleanedEmail || !cleanedEmail.includes("@"))
        throw new Error("Inserisci una email valida");
      if (cleanedEmail === email.toLowerCase())
        throw new Error("La nuova email coincide con quella attuale");
      if (!currentPassword) throw new Error("Inserisci la password attuale");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) throw new Error("Password attuale non corretta");

      const { error } = await supabase.auth.updateUser({ email: cleanedEmail });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Controlla la nuova email per confermare la modifica");
      setCurrentPassword("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Email di accesso
        </CardTitle>
        <CardDescription>
          Cambia l'indirizzo usato per entrare in Pratix. Supabase invia una conferma alla nuova
          email.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Nuova email</Label>
          <Input
            type="email"
            value={nextEmail}
            onChange={(event) => setNextEmail(event.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label>Password attuale</Label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !nextEmail || !currentPassword}
          >
            <MailCheck className="mr-2 size-4" />
            {mutation.isPending ? "Invio conferma…" : "Cambia email"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangePasswordCard({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (next.length < 8) throw new Error("La nuova password deve avere almeno 8 caratteri");
      if (next !== confirm) throw new Error("Le due password non coincidono");
      if (!email) throw new Error("Email mancante");

      // Riautenticazione di sicurezza
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) throw new Error("Password attuale non corretta");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password aggiornata");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          Cambia password
        </CardTitle>
        <CardDescription>
          Per confermare il cambio inserisci anche la password attuale.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Password attuale</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nuova password</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Almeno 8 caratteri.</p>
          </div>
          <div className="space-y-2">
            <Label>Conferma nuova password</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !current || !next || !confirm}
          >
            {mutation.isPending ? "Aggiornamento…" : "Aggiorna password"}
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!email) throw new Error("Email mancante");
      if (!currentPassword) throw new Error("Inserisci la password attuale");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) throw new Error("Password attuale non corretta");

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
        <div className="space-y-2">
          <Label>Password attuale</Label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-2">
          <Label>Conferma scrivendo ELIMINA</Label>
          <Input
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
                disabled={mutation.isPending || !currentPassword || confirmation !== "ELIMINA"}
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
                  onClick={() => mutation.mutate()}
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
