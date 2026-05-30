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
