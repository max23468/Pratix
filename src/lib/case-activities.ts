import { clientDisplayName, counterpartyDisplayName } from "@/lib/labels";

export type CaseActivityContext = {
  id: string;
  principal_id: string | null;
  client_id: string | null;
  counterparty_id: string | null;
  practice_number?: number | null;
  case_number?: string | null;
  title?: string | null;
  principals?: { business_name: string | null } | null;
  clients?: {
    kind: string;
    first_name?: string | null;
    last_name?: string | null;
    business_name?: string | null;
  } | null;
  counterparties?: {
    kind: string;
    first_name?: string | null;
    last_name?: string | null;
    business_name?: string | null;
  } | null;
};

export function activityCaseLabel(option: CaseActivityContext) {
  const practiceNumber = option.practice_number ?? option.case_number ?? "-";
  const clientName = option.clients ? clientDisplayName(option.clients) : "-";
  const counterpartyName = option.counterparties
    ? counterpartyDisplayName(option.counterparties)
    : "-";

  return `Pratica ${practiceNumber} · ${clientName} · ${counterpartyName}`;
}
