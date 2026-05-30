import type { ReactNode } from "react";

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
