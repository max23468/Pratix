import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const mobileListCardLinkClassName =
  "block rounded-md border border-border bg-card p-4 shadow-soft transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MobileListCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border bg-card p-4 shadow-soft", className)}>
      {children}
    </div>
  );
}

export function MobileListCardHeader({
  title,
  subtitle,
  eyebrow,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs text-muted-foreground">{eyebrow}</p>}
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}

export function MobileListCardDetails({
  rows,
}: {
  rows: Array<{ label: ReactNode; value: ReactNode; valueClassName?: string }>;
}) {
  if (rows.length === 0) return null;

  return (
    <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
      {rows.map((row, index) => (
        <div key={index} className="flex min-w-0 justify-between gap-3">
          <dt>{row.label}</dt>
          <dd className={cn("min-w-0 truncate text-right", row.valueClassName)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
