import { type ContropartiListBodyProps } from "@/components/counterparties/types";
import { Card } from "@/components/ui/card";
import { ContropartiEmptyState } from "@/components/counterparties/controparti-empty-state";
import { CounterpartyMobileCard } from "@/components/counterparties/counterparty-mobile-card";

export function ContropartiMobileList({
  isLoading,
  rows,
  hasFilters,
  subjectCounts,
}: ContropartiListBodyProps) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <ContropartiEmptyState hasFilters={hasFilters} />
      </Card>
    );
  }
  return rows.map((counterparty) => (
    <CounterpartyMobileCard
      key={counterparty.id}
      counterparty={counterparty}
      subjectCount={subjectCounts[counterparty.id] ?? 0}
    />
  ));
}
