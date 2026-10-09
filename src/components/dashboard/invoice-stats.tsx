import { type StatsGroupProps } from "@/components/dashboard/stats-types";
import { StatCard } from "@/components/dashboard/stat-card";
import { Receipt, AlertTriangle } from "lucide-react";
import { countValue, currencyValue, alertTone } from "@/components/dashboard/stats-helpers";

export function InvoiceStats({ data, isLoading }: StatsGroupProps) {
  return (
    <>
      <StatCard
        icon={Receipt}
        label="Fatture in bozza"
        value={countValue(isLoading, data?.draftInvoiceCount)}
        to="/fatture"
        search={{ status: "draft" }}
      />
      <StatCard
        icon={Receipt}
        label="Fatture da incassare"
        value={currencyValue(isLoading, data?.invoicesToCollectAmount)}
        tone="gold"
        to="/fatture"
        search={{ status: "to_collect" }}
      />
      <StatCard
        icon={AlertTriangle}
        label="Fatture scadute"
        value={countValue(isLoading, data?.overdueInvoiceCount)}
        tone={alertTone(data?.overdueInvoiceCount)}
        to="/fatture"
        search={{ status: "expired" }}
      />
    </>
  );
}
