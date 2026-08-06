import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type PrincipalOption = { id: string; business_name: string; archived_at: string | null };

export function ClientPrincipalLinks({
  principals,
  selectedIds,
  error,
  onToggle,
}: {
  principals: PrincipalOption[];
  selectedIds: ReadonlySet<string>;
  error: string | null;
  onToggle: (principalId: string, selected: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Committenti collegati</CardTitle>
        <p className="text-sm text-muted-foreground">
          Seleziona almeno un committente: il collegamento è obbligatorio per salvare il cliente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert id="principal-link-error" variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Committente obbligatorio</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {principals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aggiungi un committente per collegarlo a questo cliente.
          </p>
        ) : (
          principals.map((principal) => (
            <label
              key={principal.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
            >
              <span className="flex flex-col">
                <span className="font-medium">{principal.business_name}</span>
                {principal.archived_at && (
                  <span className="text-xs text-muted-foreground">Archiviato</span>
                )}
              </span>
              <Checkbox
                checked={selectedIds.has(principal.id)}
                aria-describedby={error ? "principal-link-error" : undefined}
                onCheckedChange={(checked) => onToggle(principal.id, checked === true)}
              />
            </label>
          ))
        )}
      </CardContent>
    </Card>
  );
}
