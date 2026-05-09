import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileUp, KeyRound, Save, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceCard } from "@/components/appearance-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { APP_VERSION, BUILD_DATE } from "@/lib/version";

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

function AccountPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" />
                Email di accesso
              </CardTitle>
              <CardDescription>È l'indirizzo che usi per entrare in Pratix.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} readOnly disabled />
                <p className="text-xs text-muted-foreground">
                  Per cambiare l'email di accesso scrivi al supporto. Stiamo lavorando alla modifica
                  autonoma.
                </p>
              </div>
            </CardContent>
          </Card>

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
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function DataExportCard() {
  const exportMutation = useMutation({
    mutationFn: async () => {
      const tables = [
        "principals",
        "principal_clients",
        "clients",
        "counterparties",
        "counterparty_subjects",
        "cases",
        "case_activities",
        "case_activity_hearings",
        "activity_attachments",
        "price_books",
        "price_items",
        "invoices",
        "invoice_lines",
      ] as const;

      const entries = await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await supabase.from(table).select("*");
          if (error) throw error;
          return [table, data ?? []] as const;
        }),
      );

      const payload = {
        exportedAt: new Date().toISOString(),
        product: "Pratix",
        data: Object.fromEntries(entries),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pratix-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success("Export dati generato"),
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
          Scarica un archivio JSON con anagrafiche, pratiche, attività, prezzi e fatture.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? "Preparazione…" : "Scarica export JSON"}
        </Button>
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
