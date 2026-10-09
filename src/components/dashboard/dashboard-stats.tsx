import { type StatsGroupProps } from "@/components/dashboard/stats-types";
import { CaseStats } from "@/components/dashboard/case-stats";
import { ActivityStats } from "@/components/dashboard/activity-stats";
import { InvoiceStats } from "@/components/dashboard/invoice-stats";
import { ExpenseAttachmentStat } from "@/components/dashboard/expense-attachment-stat";

export function DashboardStats({ data, isLoading }: StatsGroupProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <CaseStats data={data} isLoading={isLoading} />
      <ActivityStats data={data} isLoading={isLoading} />
      <InvoiceStats data={data} isLoading={isLoading} />
      <ExpenseAttachmentStat data={data} isLoading={isLoading} />
    </div>
  );
}
