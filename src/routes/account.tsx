import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { DataExportCard } from "@/components/account/data-export-card";
import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { EmailAccessCard } from "@/components/account/email-access-card";
import { PasskeyAccessCard } from "@/components/account/passkey-access-card";
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
import { useSubmitLock } from "@/lib/submit-lock";

export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
    tab: parseAccountTab(search.tab),
  }),
  head: () => ({
    meta: [
      { title: "Account · Pratix" },
      {
        name: "description",
        content: "Profilo, accesso, aspetto, notifiche e dati del tuo account Pratix.",
      },
      { property: "og:title", content: "Account · Pratix" },
      {
        property: "og:description",
        content: "Profilo, accesso, aspetto, notifiche e dati del tuo account Pratix.",
      },
    ],
  }),
  component: AccountPage,
});

const accountTabs = ["profilo", "sicurezza", "aspetto", "notifiche", "dati"] as const;

type AccountTab = (typeof accountTabs)[number];

type AccountSearch = {
  tab?: AccountTab;
};

function parseAccountTab(tab: unknown) {
  return accountTabs.includes(tab as AccountTab) ? (tab as AccountTab) : undefined;
}

type ProfileForm = {
  full_name: string;
  email: string;
  phone: string;
};

function AccountPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const activeTab = search.tab ?? "profilo";
  const [form, setForm] = useState<ProfileForm>({ full_name: "", email: "", phone: "" });
  const [loadedProfileKey, setLoadedProfileKey] = useState<string | null>(null);
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

  const profileKey = data
    ? [data.full_name ?? "", data.email ?? "", data.phone ?? ""].join("|")
    : null;

  if (data && profileKey !== loadedProfileKey) {
    setForm({
      full_name: data.full_name ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
    });
    setLoadedProfileKey(profileKey);
  }

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
        description="Profilo, accesso, aspetto, notifiche e dati personali del professionista."
      />

      <Tabs
        value={activeTab}
        onValueChange={(nextTab) => {
          navigate({
            search: { tab: parseAccountTab(nextTab) },
            replace: true,
          });
        }}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="profilo" className="min-w-0 whitespace-normal text-center">
            Profilo
          </TabsTrigger>
          <TabsTrigger value="sicurezza" className="min-w-0 whitespace-normal text-center">
            Accesso e sicurezza
          </TabsTrigger>
          <TabsTrigger value="aspetto" className="min-w-0 whitespace-normal text-center">
            Aspetto
          </TabsTrigger>
          <TabsTrigger value="notifiche" className="min-w-0 whitespace-normal text-center">
            Notifiche
          </TabsTrigger>
          <TabsTrigger value="dati" className="min-w-0 whitespace-normal text-center">
            Dati
          </TabsTrigger>
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
          <EmailAccessCard key={user?.email ?? ""} email={user?.email ?? ""} />
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
          <DataExportCard />

          <DeleteAccountCard
            email={user?.email ?? ""}
            onDeleted={async () => {
              qc.clear();
              await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
              navigate({ to: "/" });
            }}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
