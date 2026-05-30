import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MobileListCardDetails({
  rows,
}: {
  rows: Array<{ label: ReactNode; value: ReactNode; valueClassName?: string }>;
}) {
  if (rows.length === 0) return null;

  return (
    <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
      {rows.map((row) => (
        <div key={String(row.label)} className="flex min-w-0 justify-between gap-3">
          <dt>{row.label}</dt>
          <dd className={cn("min-w-0 truncate text-right", row.valueClassName)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
