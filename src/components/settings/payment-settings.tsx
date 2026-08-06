import { Field } from "@/components/settings/field";
import type { ProfileForm, SetProfileField } from "@/components/settings/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";

export function PaymentSettings({ form, set }: { form: ProfileForm; set: SetProfileField }) {
  return (
    <TabsContent value="pagamenti" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Coordinate bancarie</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Banca"
            value={form.bank_name}
            onChange={(value) => set("bank_name", value)}
            placeholder="Es. Banca Alfa"
          />
          <div className="sm:col-span-2">
            <Field
              label="IBAN"
              value={form.iban}
              onChange={(value) => set("iban", value.toUpperCase().replace(/\s+/g, ""))}
              placeholder="Es. IT60X0542811101000000123456"
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
