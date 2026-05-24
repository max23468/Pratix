import { MetricTile } from "@/components/metric-tile";

export function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number | string;
  description?: string;
}) {
  return <MetricTile label={title} value={value} description={description} size="comfortable" />;
}
