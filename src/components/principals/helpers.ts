export const committentiSortKeys = [
  "business_name",
  "status",
  "economics",
  "tax",
  "email",
  "city",
  "created_at",
] as const;

export const principalStatusFilters = ["all", "active", "archived"] as const;

export const principalEconomicsFilters = [
  "all",
  "fees",
  "expenses",
  "fees_only",
  "expenses_only",
] as const;

export function economicRulesLabel(principal: {
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
}) {
  if (principal.fees_enabled && principal.expense_reimbursements_enabled) {
    return "Compensi e rimborsi";
  }
  if (principal.fees_enabled) return "Solo compensi";
  if (principal.expense_reimbursements_enabled) return "Solo rimborsi";
  return "Nessuna regola";
}
