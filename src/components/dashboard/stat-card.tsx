import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStatCardProps } from "@/components/dashboard/types";

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  to,
  search,
}: DashboardStatCardProps) {
  const iconCls =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "gold"
        ? "bg-brand-gold/10 text-brand-gold"
        : "bg-primary/5 text-primary";
  const valueCls = tone === "danger" ? "text-destructive" : "text-foreground";

  const content = (
    <Card className="h-full border-border/70 shadow-soft transition-colors group-hover:bg-accent/40">
      <CardContent className="flex min-h-[7rem] flex-col items-start gap-2 p-3 sm:min-h-0 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 ${iconCls}`}
        >
          <Icon className="size-5" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 self-stretch sm:self-auto">
          <p className="text-[11px] leading-snug font-medium text-muted-foreground sm:text-xs">
            {label}
          </p>
          <p
            className={`font-display tabular text-lg leading-tight font-semibold tracking-tight break-words sm:text-xl ${valueCls}`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
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
