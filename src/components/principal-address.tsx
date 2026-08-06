import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PrincipalAddress({
  street,
  city,
  zip,
  province,
  onStreetChange,
  onCityChange,
  onZipChange,
  onProvinceChange,
}: {
  street: string;
  city: string;
  zip: string;
  province: string;
  onStreetChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onZipChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Indirizzo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="address_street">Indirizzo</Label>
          <Input
            id="address_street"
            value={street}
            onChange={(event) => onStreetChange(event.target.value)}
            placeholder="Es. Via Roma 10"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="address_city">Città</Label>
            <Input
              id="address_city"
              value={city}
              onChange={(event) => onCityChange(event.target.value)}
              placeholder="Es. Milano"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="address_zip">CAP</Label>
            <Input
              id="address_zip"
              value={zip}
              onChange={(event) => onZipChange(event.target.value)}
              placeholder="Es. 20121"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="address_province">Prov.</Label>
            <Input
              id="address_province"
              maxLength={2}
              value={province}
              onChange={(event) => onProvinceChange(event.target.value.toUpperCase())}
              placeholder="MI"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
