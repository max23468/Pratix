import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SummaryTileTone = "default" | "danger" | "gold";

export function SummaryTile({
  label,
  value,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: SummaryTileTone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border p-3", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "gold" && "text-brand-gold",
        )}
      >
        {value}
      </p>
    </div>
  );
}
