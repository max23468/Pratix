import { Field } from "@/components/settings/field";
import { NumField } from "@/components/settings/num-field";
import type { ProfileForm, SetProfileField } from "@/components/settings/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";

export function InvoiceSettings({ form, set }: { form: ProfileForm; set: SetProfileField }) {
  return (
    <TabsContent value="fatturazione" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bollo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="include-stamp-duty">Includi bollo in fattura</Label>
              <p className="text-sm text-muted-foreground">
                Se attivo, Pratix addebita 2 € quando la fattura supera la soglia prevista.
              </p>
            </div>
            <Switch
              id="include-stamp-duty"
              checked={form.include_stamp_duty}
              onCheckedChange={(value) => set("include_stamp_duty", value)}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Numerazione fatture</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Prefisso (opzionale)"
            value={form.invoice_number_prefix}
            onChange={(value) => set("invoice_number_prefix", value)}
            placeholder="Es. FT-"
          />
          <NumField
            label="Anno corrente"
            value={form.invoice_year}
            onChange={(value) => set("invoice_year", Math.round(value))}
            step={1}
          />
          <NumField
            label="Prossimo numero"
            value={form.invoice_next_number}
            onChange={(value) => set("invoice_next_number", Math.max(1, Math.round(value)))}
            step={1}
          />
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Esempio: con prefisso "FT-" e prossimo numero 7, la prossima fattura sarà{" "}
            <strong>FT-7</strong>. L'anno si resetta automaticamente al cambio di anno solare.
          </p>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
