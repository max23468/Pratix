import { type CommittentiListBodyProps } from "@/components/principals/types";
import { Card } from "@/components/ui/card";
import { CommittentiEmptyState } from "@/components/principals/committenti-empty-state";
import { PrincipalMobileCard } from "@/components/principals/principal-mobile-card";

export function CommittentiMobileList({ isLoading, rows, hasFilters }: CommittentiListBodyProps) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <CommittentiEmptyState hasFilters={hasFilters} />
      </Card>
    );
  }
  return rows.map((principal) => <PrincipalMobileCard key={principal.id} principal={principal} />);
}
