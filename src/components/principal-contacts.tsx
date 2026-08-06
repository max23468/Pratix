import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PrincipalContacts({
  email,
  phone,
  pec,
  sdiCode,
  onEmailChange,
  onPhoneChange,
  onPecChange,
  onSdiCodeChange,
}: {
  email: string;
  phone: string;
  pec: string;
  sdiCode: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPecChange: (value: string) => void;
  onSdiCodeChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contatti</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="Es. amministrazione@bancaalfa.it"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="Es. 0212345678"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pec">PEC</Label>
          <Input
            id="pec"
            type="email"
            value={pec}
            onChange={(event) => onPecChange(event.target.value)}
            placeholder="Es. bancaalfa@pec.it"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sdi_code">Codice destinatario SdI</Label>
          <Input
            id="sdi_code"
            value={sdiCode}
            onChange={(event) => onSdiCodeChange(event.target.value.toUpperCase().slice(0, 7))}
            placeholder="Es. 0000000"
          />
        </div>
      </CardContent>
    </Card>
  );
}
