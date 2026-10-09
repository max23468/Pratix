import { type CaseDebtCollectionWorkflow } from "@/lib/case-workflow";
import { praticheSortKeys, praticheViewKeys } from "@/components/practices/helpers";

export type PracticeListRow = {
  id: string;
  public_code: string;
  practice_number: number;
  status: string;
  opened_at: string;
  updated_at: string;
  client_id: string | null;
  principal_id: string | null;
  counterparty_id: string | null;
  principals: { business_name: string } | null;
  clients: {
    kind: string;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
  } | null;
  counterparties: {
    kind: string;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
  } | null;
};

export type PracticeWorkflowRow = {
  stage: string;
  action: string;
  reason: string;
  priorityLabel: string;
  priorityVariant: CaseDebtCollectionWorkflow["priorityVariant"];
};

export type PraticheSortKey = (typeof praticheSortKeys)[number];

export type PraticheView = (typeof praticheViewKeys)[number];

export type PracticeActivitySummary = {
  toInvoice: number;
  invoiced: number;
  toInvoiceAmount: number;
};

export type PracticeListBodyProps = {
  isLoading: boolean;
  rows: PracticeListRow[];
  hasFilters: boolean;
  activitySummaryByCase: Record<string, PracticeActivitySummary>;
};
