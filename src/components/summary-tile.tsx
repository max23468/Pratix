import type { ReactNode } from "react";
import { MetricTile, type MetricTileTone } from "@/components/metric-tile";

export function SummaryTile({
  label,
  value,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: MetricTileTone;
  className?: string;
}) {
  return <MetricTile label={label} value={value} tone={tone} className={className} />;
}
