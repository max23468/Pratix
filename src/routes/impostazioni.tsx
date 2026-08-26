import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { InvoiceSettings } from "@/components/settings/invoice-settings";
import { PaymentSettings } from "@/components/settings/payment-settings";
import type { ProfileForm } from "@/components/settings/profile-form";
import { Field } from "@/components/settings/field";
import { NumField } from "@/components/settings/num-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { useSubmitLock } from "@/lib/submit-lock";

export const Route = createFileRoute("/impostazioni")({
  head: () => ({
    meta: [
      { title: "Impostazioni · Pratix" },
      {
        name: "description",
        content: "Configura i tuoi dati professionali, fiscali e di numerazione.",
      },
      { property: "og:title", content: "Impostazioni · Pratix" },
      {
        property: "og:description",
        content: "Configura i tuoi dati professionali, fiscali e di numerazione.",
      },
    ],
  }),
  component: SettingsPage,
});

const empty = (): ProfileForm => ({
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
  include_stamp_duty: false,
  bank_name: "",
  iban: "",
  invoice_number_prefix: "",
  invoice_year: new Date().getFullYear(),
  invoice_next_number: 1,
  notes: "",
});

function profileForm(data: Record<string, unknown>): ProfileForm {
  return {
    full_name: String(data.full_name ?? ""),
    business_name: String(data.business_name ?? ""),
    vat_number: String(data.vat_number ?? ""),
    tax_code: String(data.tax_code ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    pec: String(data.pec ?? ""),
    bar_association: String(data.bar_association ?? ""),
    address_street: String(data.address_street ?? ""),
    address_zip: String(data.address_zip ?? ""),
    address_city: String(data.address_city ?? ""),
    address_province: String(data.address_province ?? ""),
    address_country: String(data.address_country ?? "IT"),
    tax_regime: (data.tax_regime as "ordinario" | "forfettario") ?? "ordinario",
    cassa_rate: Number(data.cassa_rate ?? 4),
    vat_rate: Number(data.vat_rate ?? 22),
    withholding_rate: Number(data.withholding_rate ?? 20),
    apply_withholding: Boolean(data.apply_withholding ?? true),
    include_stamp_duty: Boolean(data.include_stamp_duty ?? false),
    bank_name: String(data.bank_name ?? ""),
    iban: String(data.iban ?? ""),
    invoice_number_prefix: String(data.invoice_number_prefix ?? ""),
    invoice_year: Number(data.invoice_year ?? new Date().getFullYear()),
    invoice_next_number: Number(data.invoice_next_number ?? 1),
    notes: "",
  };
}

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [formSource, setFormSource] = useState<unknown>();
  const saveLock = useSubmitLock();

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

  if (data !== formSource) {
    setFormSource(data);
    setForm(data ? profileForm(data) : empty());
  }

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
        ...(form.tax_regime === "forfettario" ? { apply_withholding: false } : {}),
        onboarding_completed: true,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Impostazioni salvate");
      qc.invalidateQueries({ queryKey: ["profile-full"] });
      qc.invalidateQueries({ queryKey: ["profile-invoice-defaults"] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: saveLock.release,
  });

  return (
    <AppLayout>
      <PageHeader
        title="Impostazioni"
        description="Dati professionali, fiscalità, pagamenti e fatturazione. Account resta dedicato a profilo, accesso e tema."
        actions={
          <Button
            onClick={() => {
              if (saveLock.acquire()) saveMutation.mutate();
            }}
            disabled={saveMutation.isPending || isLoading}
          >
            <Save className="mr-2 size-4" />
            {saveMutation.isPending ? "Salvataggio…" : "Salva modifiche"}
          </Button>
        }
      />

      <Tabs defaultValue="professione" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="professione" className="min-w-0 whitespace-normal text-center">
            Dati professionali
          </TabsTrigger>
          <TabsTrigger value="fiscale" className="min-w-0 whitespace-normal text-center">
            Fiscalità
          </TabsTrigger>
          <TabsTrigger value="pagamenti" className="min-w-0 whitespace-normal text-center">
            Pagamenti
          </TabsTrigger>
          <TabsTrigger value="fatturazione" className="min-w-0 whitespace-normal text-center">
            Fatturazione
          </TabsTrigger>
        </TabsList>

        <TabsContent value="professione" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anagrafica</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Ragione sociale / Denominazione"
                value={form.business_name}
                onChange={(v) => set("business_name", v)}
                placeholder="Es. Avv. Nome Cognome"
              />
              <Field
                label="Nome e cognome titolare"
                value={form.full_name}
                onChange={(v) => set("full_name", v)}
                placeholder="Es. Nome Cognome"
              />
              <Field
                label="Partita IVA *"
                value={form.vat_number}
                onChange={(v) => set("vat_number", v)}
                placeholder="Es. 01234567890"
              />
              <Field
                label="Codice Fiscale"
                value={form.tax_code}
                onChange={(v) => set("tax_code", v)}
                placeholder="Es. RSSNNA80A01F205X"
              />
              <Field
                label="Ordine degli Avvocati"
                value={form.bar_association}
                onChange={(v) => set("bar_association", v)}
                placeholder="Es. Milano"
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => set("email", v)}
                placeholder="Es. nome.cognome@example.it"
              />
              <Field
                label="PEC"
                type="email"
                value={form.pec}
                onChange={(v) => set("pec", v)}
                placeholder="Es. nome.cognome@pec.it"
              />
              <Field
                label="Telefono"
                value={form.phone}
                onChange={(v) => set("phone", v)}
                placeholder="Es. 0212345678"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sede</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Indirizzo"
                  value={form.address_street}
                  onChange={(v) => set("address_street", v)}
                  placeholder="Es. Via Roma 10"
                />
              </div>
              <Field
                label="CAP"
                value={form.address_zip}
                onChange={(v) => set("address_zip", v)}
                placeholder="Es. 20121"
              />
              <Field
                label="Città"
                value={form.address_city}
                onChange={(v) => set("address_city", v)}
                placeholder="Es. Milano"
              />
              <Field
                label="Provincia"
                value={form.address_province}
                onChange={(v) => set("address_province", v.toUpperCase().slice(0, 2))}
                placeholder="MI"
              />
              <Field
                label="Nazione"
                value={form.address_country}
                onChange={(v) => set("address_country", v.toUpperCase().slice(0, 2))}
                placeholder="IT"
              />
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
                  <SelectTrigger aria-label="Regime fiscale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(taxRegimeLabels).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  In regime forfettario IVA e ritenuta non vengono applicate; la Cassa Forense resta
                  calcolata sui compensi.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aliquote di default</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <NumField
                label="Cassa Forense %"
                value={form.cassa_rate}
                onChange={(v) => set("cassa_rate", v)}
              />
              <NumField label="IVA %" value={form.vat_rate} onChange={(v) => set("vat_rate", v)} />
              <NumField
                label="Ritenuta %"
                value={form.withholding_rate}
                onChange={(v) => set("withholding_rate", v)}
              />
              <div className="flex items-center gap-2 sm:col-span-3">
                <Switch
                  id="apply-with"
                  checked={form.apply_withholding}
                  onCheckedChange={(v) => set("apply_withholding", v)}
                  disabled={form.tax_regime === "forfettario"}
                />
                <Label htmlFor="apply-with">Applica ritenuta d'acconto per default</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <PaymentSettings form={form} set={set} />
        <InvoiceSettings form={form} set={set} />
      </Tabs>
    </AppLayout>
  );
}
