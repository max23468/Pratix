import { type StatsGroupProps } from "@/components/dashboard/stats-types";
import { StatCard } from "@/components/dashboard/stat-card";
import { Briefcase, AlertTriangle } from "lucide-react";
import { countValue, alertTone } from "@/components/dashboard/stats-helpers";

export function CaseStats({ data, isLoading }: StatsGroupProps) {
  return (
    <>
      <StatCard
        icon={Briefcase}
        label="Pratiche senza attività"
        value={countValue(isLoading, data?.casesWithoutActivities)}
        to="/pratiche"
        search={{ view: "without_activities" }}
      />
      <StatCard
        icon={AlertTriangle}
        label="Pratiche da completare"
        value={countValue(isLoading, data?.casesToComplete)}
        tone={alertTone(data?.casesToComplete)}
        to="/pratiche"
        search={{ view: "to_complete" }}
      />
    </>
  );
}
