import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { taxRegimeLabels } from "@/lib/labels";

export const Route = createFileRoute("/impostazioni")({
  head: () => ({
    meta: [
      { title: "Impostazioni — Pratix" },
      { name: "description", content: "Configura i tuoi dati professionali, fiscali e di numerazione." },
      { property: "og:title", content: "Impostazioni — Pratix" },
      { property: "og:description", content: "Configura i tuoi dati professionali, fiscali e di numerazione." },
    ],
  }),
  component: SettingsPage,
});

type ProfileForm = {
  full_name: string;
  business_name: string;
  vat_number: string;
  tax_code: string;
  email: string;
  phone: string;
  pec: string;
  bar_association: string;
  address_street: string;
  address_zip: string;
  address_city: string;
  address_province: string;
  address_country: string;
  tax_regime: "ordinario" | "forfettario";
  cassa_rate: number;
  vat_rate: number;
  withholding_rate: number;
  apply_withholding: boolean;
  bank_name: string;
  iban: string;
  invoice_number_prefix: string;
  invoice_year: number;
  invoice_next_number: number;
  notes: string;
};

const empty: ProfileForm = {
  full_name: "",
  business_name: "",
  vat_number: "",
  tax_code: "",
  email: "",
  phone: "",
  pec: "",
  bar_association: "",
  address_street: "",
  address_zip: "",
  address_city: "",
  address_province: "",
  address_country: "IT",
  tax_regime: "ordinario",
  cassa_rate: 4,
  vat_rate: 22,
  withholding_rate: 20,
  apply_withholding: true,
  bank_name: "",
  iban: "",
  invoice_number_prefix: "",
  invoice_year: new Date().getFullYear(),
  invoice_next_number: 1,
  notes: "",
};

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<ProfileForm>(empty);

  const { data, isLoading } = useQuery({
    queryKey: ["profile-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
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
      business_name: data.business_name ?? "",
      vat_number: data.vat_number ?? "",
      tax_code: data.tax_code ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      pec: data.pec ?? "",
      bar_association: data.bar_association ?? "",
      address_street: data.address_street ?? "",
      address_zip: data.address_zip ?? "",
      address_city: data.address_city ?? "",
      address_province: data.address_province ?? "",
      address_country: data.address_country ?? "IT",
      tax_regime: (data.tax_regime as "ordinario" | "forfettario") ?? "ordinario",
      cassa_rate: Number(data.cassa_rate ?? 4),
      vat_rate: Number(data.vat_rate ?? 22),
      withholding_rate: Number(data.withholding_rate ?? 20),
      apply_withholding: data.apply_withholding ?? true,
      bank_name: data.bank_name ?? "",
      iban: data.iban ?? "",
      invoice_number_prefix: data.invoice_number_prefix ?? "",
      invoice_year: data.invoice_year ?? new Date().getFullYear(),
      invoice_next_number: data.invoice_next_number ?? 1,
      notes: "",
    });
  }, [data]);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      const { notes: _notes, ...rest } = form;
      void _notes;
      const payload = {
        ...rest,
        // forfettario: forziamo coerenza dei flag fiscali
        ...(form.tax_regime === "forfettario"
          ? { apply_withholding: false }
          : {}),
        onboarding_completed: true,
      };
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Impostazioni salvate");
      qc.invalidateQueries({ queryKey: ["profile-full"] });
      qc.invalidateQueries({ queryKey: ["profile-invoice-defaults"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <PageHeader
        title="Impostazioni"
        description="I dati della tua attività professionale, fiscalità, IBAN e numerazione. Per profilo, accesso e tema vai ad Account."
        actions={
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? "Salvataggio…" : "Salva modifiche"}
          </Button>
        }
      />

      <Tabs defaultValue="attivita" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="attivita">Attività</TabsTrigger>
          <TabsTrigger value="fiscale">Fiscale</TabsTrigger>
          <TabsTrigger value="pagamenti">Pagamenti</TabsTrigger>
          <TabsTrigger value="numerazione">Numerazione</TabsTrigger>
        </TabsList>

        <TabsContent value="attivita" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anagrafica</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Ragione sociale / Denominazione" value={form.business_name} onChange={(v) => set("business_name", v)} placeholder="Es. Avv. Mario Rossi" />
              <Field label="Nome e cognome titolare" value={form.full_name} onChange={(v) => set("full_name", v)} />
              <Field label="Partita IVA *" value={form.vat_number} onChange={(v) => set("vat_number", v)} placeholder="11 cifre" />
              <Field label="Codice Fiscale" value={form.tax_code} onChange={(v) => set("tax_code", v)} />
              <Field label="Ordine degli Avvocati" value={form.bar_association} onChange={(v) => set("bar_association", v)} placeholder="Es. Milano" />
              <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
              <Field label="PEC" type="email" value={form.pec} onChange={(v) => set("pec", v)} />
              <Field label="Telefono" value={form.phone} onChange={(v) => set("phone", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sede</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Indirizzo" value={form.address_street} onChange={(v) => set("address_street", v)} placeholder="Via, numero civico" />
              </div>
              <Field label="CAP" value={form.address_zip} onChange={(v) => set("address_zip", v)} />
              <Field label="Città" value={form.address_city} onChange={(v) => set("address_city", v)} />
              <Field label="Provincia" value={form.address_province} onChange={(v) => set("address_province", v.toUpperCase().slice(0, 2))} placeholder="MI" />
              <Field label="Nazione" value={form.address_country} onChange={(v) => set("address_country", v.toUpperCase().slice(0, 2))} placeholder="IT" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiscale" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regime fiscale</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Regime</Label>
                <Select
                  value={form.tax_regime}
                  onValueChange={(v) => set("tax_regime", v as "ordinario" | "forfettario")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(taxRegimeLabels).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  In regime forfettario IVA, cassa addebitata e ritenuta non vengono applicate.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aliquote di default</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <NumField label="Cassa Forense %" value={form.cassa_rate} onChange={(v) => set("cassa_rate", v)} />
              <NumField label="IVA %" value={form.vat_rate} onChange={(v) => set("vat_rate", v)} />
              <NumField label="Ritenuta %" value={form.withholding_rate} onChange={(v) => set("withholding_rate", v)} />
              <div className="flex items-center gap-2 sm:col-span-3">
                <Switch
                  id="apply-with"
                  checked={form.apply_withholding}
                  onCheckedChange={(v) => set("apply_withholding", v)}
                  disabled={form.tax_regime === "forfettario"}
                />
                <Label htmlFor="apply-with">
                  Applica ritenuta d'acconto per default
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamenti" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coordinate bancarie</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Banca" value={form.bank_name} onChange={(v) => set("bank_name", v)} />
              <div className="sm:col-span-2">
                <Field
                  label="IBAN"
                  value={form.iban}
                  onChange={(v) => set("iban", v.toUpperCase().replace(/\s+/g, ""))}
                  placeholder="IT60X0542811101000000123456"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numerazione" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Numerazione fatture</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Prefisso (opzionale)"
                value={form.invoice_number_prefix}
                onChange={(v) => set("invoice_number_prefix", v)}
                placeholder="Es. FT-"
              />
              <NumField
                label="Anno corrente"
                value={form.invoice_year}
                onChange={(v) => set("invoice_year", Math.round(v))}
                step={1}
              />
              <NumField
                label="Prossimo numero"
                value={form.invoice_next_number}
                onChange={(v) => set("invoice_next_number", Math.max(1, Math.round(v)))}
                step={1}
              />
              <p className="text-xs text-muted-foreground sm:col-span-3">
                Esempio: con prefisso "FT-" e prossimo numero 7, la prossima fattura sarà <strong>FT-7</strong>.
                L'anno si resetta automaticamente al cambio di anno solare.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
