import { type StatsGroupProps } from "@/components/dashboard/stats-types";
import { StatCard } from "@/components/dashboard/stat-card";
import { FileWarning } from "lucide-react";
import { countValue, alertTone } from "@/components/dashboard/stats-helpers";

export function ExpenseAttachmentStat({ data, isLoading }: StatsGroupProps) {
  return (
    <StatCard
      icon={FileWarning}
      label="Rimborsi senza allegato"
      value={countValue(isLoading, data?.expenseWithoutAttachmentCount)}
      tone={alertTone(data?.expenseWithoutAttachmentCount)}
      to="/attivita"
      search={{ status: "to_invoice", kind: "expense_reimbursement", attachments: "missing" }}
    />
  );
}
