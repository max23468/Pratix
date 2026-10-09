import { type PrincipalListRow } from "@/components/principals/types";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { mobileListCardLinkClassName } from "@/components/mobile-list-card";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { economicRulesLabel } from "@/components/principals/helpers";
import { PrincipalStatusBadge } from "@/components/principals/principal-status-badge";
import { MobileListCardDetails } from "@/components/mobile-list-card-details";

export function PrincipalMobileCard({ principal }: { principal: PrincipalListRow }) {
  return (
    <Link
      to="/committenti/$principalId"
      params={{ principalId: routeRef(principal) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={principal.business_name}
        subtitle={economicRulesLabel(principal)}
        badge={<PrincipalStatusBadge archived={!!principal.archived_at} />}
      />
      <MobileListCardDetails
        rows={[
          {
            label: "CF / P.IVA",
            value: principal.vat_number || principal.tax_code || "—",
          },
          { label: "Email", value: principal.email ?? "—" },
          { label: "Città", value: principal.address_city ?? "—" },
        ]}
      />
    </Link>
  );
}
