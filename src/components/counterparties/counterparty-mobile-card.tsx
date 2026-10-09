import { type CounterpartyListRow } from "@/components/counterparties/types";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { mobileListCardLinkClassName } from "@/components/mobile-list-card";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { counterpartyDisplayName, counterpartyKindLabels } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";

export function CounterpartyMobileCard({
  counterparty,
  subjectCount,
}: {
  counterparty: CounterpartyListRow;
  subjectCount: number;
}) {
  return (
    <Link
      to="/controparti/$counterpartyId"
      params={{ counterpartyId: routeRef(counterparty) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={counterpartyDisplayName(counterparty)}
        subtitle={
          counterparty.kind === "group" ? `${subjectCount} soggetti` : "Controparte singola"
        }
        badge={
          <Badge variant="outline">
            {counterpartyKindLabels[counterparty.kind] ?? counterparty.kind}
          </Badge>
        }
      />
      {counterparty.notes && (
        <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{counterparty.notes}</p>
      )}
    </Link>
  );
}
