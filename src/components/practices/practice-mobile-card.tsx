import {
  type PracticeListRow,
  type PracticeActivitySummary,
  type PracticeWorkflowRow,
} from "@/components/practices/types";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { mobileListCardLinkClassName } from "@/components/mobile-list-card";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { PracticeStatusBadge } from "@/components/practices/practice-status-badge";
import { PracticeWorkflowSummary } from "@/components/practices/practice-workflow-summary";
import { MobileListCardDetails } from "@/components/mobile-list-card-details";
import { clientDisplayName, counterpartyDisplayName } from "@/lib/labels";
import { practiceBillingLabel } from "@/components/practices/helpers";
import { formatDate } from "@/lib/format";

export function PracticeMobileCard({
  practice,
  summary,
  workflow,
}: {
  practice: PracticeListRow;
  summary: PracticeActivitySummary;
  workflow?: PracticeWorkflowRow;
}) {
  return (
    <Link
      to="/pratiche/$caseId"
      params={{ caseId: routeRef(practice) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={practice.practice_number}
        badge={<PracticeStatusBadge status={practice.status} />}
      />
      {workflow ? <PracticeWorkflowSummary workflow={workflow} /> : null}
      <MobileListCardDetails
        rows={[
          { label: "Committente", value: practice.principals?.business_name ?? "—" },
          {
            label: "Cliente",
            value: practice.clients ? clientDisplayName(practice.clients) : "—",
          },
          {
            label: "Controparte",
            value: practice.counterparties ? counterpartyDisplayName(practice.counterparties) : "—",
          },
          { label: "Fatturazione", value: practiceBillingLabel(summary, true) },
          { label: "Aperta il", value: formatDate(practice.opened_at) },
        ]}
      />
    </Link>
  );
}
