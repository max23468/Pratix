import { type ClientListRow } from "@/components/clients/types";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { mobileListCardLinkClassName } from "@/components/mobile-list-card";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { clientDisplayName, clientKindLabels } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";

export function ClientMobileCard({
  client,
  principalNames,
}: {
  client: ClientListRow;
  principalNames?: string[];
}) {
  return (
    <Link
      to="/clienti/$clientId"
      params={{ clientId: routeRef(client) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={clientDisplayName(client)}
        subtitle={principalNames?.join(", ") || "Nessun committente collegato"}
        badge={<Badge variant="outline">{clientKindLabels[client.kind] ?? client.kind}</Badge>}
      />
    </Link>
  );
}
