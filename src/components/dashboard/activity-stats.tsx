import { type StatsGroupProps } from "@/components/dashboard/stats-types";
import { StatCard } from "@/components/dashboard/stat-card";
import { ListChecks, Receipt } from "lucide-react";
import { countValue, currencyValue } from "@/components/dashboard/stats-helpers";

export function ActivityStats({ data, isLoading }: StatsGroupProps) {
  return (
    <>
      <StatCard
        icon={ListChecks}
        label="Attività da fatturare"
        value={countValue(isLoading, data?.toInvoiceCount)}
        to="/attivita"
        search={{ status: "to_invoice" }}
      />
      <StatCard
        icon={Receipt}
        label="Maturato da fatturare"
        value={currencyValue(isLoading, data?.toInvoiceAmount)}
        tone="gold"
        to="/attivita"
        search={{ status: "to_invoice", sort: "amount", dir: "desc" }}
      />
    </>
  );
}
