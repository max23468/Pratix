import { Badge } from "@/components/ui/badge";
import { caseStatusVariant, caseStatusLabels } from "@/lib/labels";

export function PracticeStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={caseStatusVariant[status] ?? "outline"}>
      {caseStatusLabels[status] ?? status}
    </Badge>
  );
}
