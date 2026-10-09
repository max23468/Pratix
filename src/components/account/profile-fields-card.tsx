import { type ProfileForm } from "@/components/account/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function ProfileFieldsCard({
  form,
  onChange,
}: {
  form: ProfileForm;
  onChange: (field: keyof ProfileForm, value: string) => void;
}) {
  return (
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
            onChange={(e) => onChange("full_name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-contact-email">Email di contatto</Label>
          <Input
            id="profile-contact-email"
            type="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
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
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
