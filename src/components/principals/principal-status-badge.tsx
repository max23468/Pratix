import { Badge } from "@/components/ui/badge";

export function PrincipalStatusBadge({ archived }: { archived: boolean }) {
  return (
    <Badge variant={archived ? "secondary" : "outline"}>{archived ? "Archiviato" : "Attivo"}</Badge>
  );
}
