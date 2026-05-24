import { Link } from "@tanstack/react-router";
import { MetricTile } from "@/components/metric-tile";
import type { DashboardStatCardProps } from "@/components/dashboard/types";

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  to,
  search,
}: DashboardStatCardProps) {
  const content = (
    <MetricTile
      label={label}
      value={value}
      tone={tone}
      icon={Icon}
      className="h-full min-h-[7rem] border-border/70 shadow-soft transition-colors group-hover:bg-accent/40 sm:min-h-0"
    />
  );

  const className =
    "group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const ariaLabel = `Apri ${label.toLowerCase()}`;

  if (to === "/pratiche") {
    return (
      <Link to="/pratiche" search={search} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  if (to === "/attivita") {
    return (
      <Link to="/attivita" search={search} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Link to="/fatture" search={search} aria-label={ariaLabel} className={className}>
      {content}
    </Link>
  );
}
