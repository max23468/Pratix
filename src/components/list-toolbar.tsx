import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ListToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex flex-col gap-2 lg:flex-row lg:items-center", className)}>
      {children}
    </div>
  );
}
