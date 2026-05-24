import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MetricTileTone = "default" | "danger" | "gold";
export type MetricTileSize = "compact" | "comfortable";

export function MetricTile({
  label,
  value,
  description,
  icon: Icon,
  tone = "default",
  size = "compact",
  className,
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: MetricTileTone;
  size?: MetricTileSize;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card text-card-foreground",
        size === "compact" ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              tone === "danger"
                ? "bg-destructive/10 text-destructive"
                : tone === "gold"
                  ? "bg-brand-gold/10 text-brand-gold"
                  : "bg-primary/5 text-primary",
            )}
          >
            <Icon className="size-5" strokeWidth={1.6} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 break-words font-display text-lg font-semibold leading-tight tracking-tight tabular-nums text-foreground",
              tone === "danger" && "text-destructive",
              tone === "gold" && "text-brand-gold",
              size === "comfortable" && "text-2xl",
            )}
          >
            {value}
          </p>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
    </div>
  );
}
