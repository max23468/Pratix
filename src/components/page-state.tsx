import type { ReactNode } from "react";
import { AlertTriangle, LoaderCircle, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageStateVariant = "loading" | "not-found" | "error" | "empty";

const defaultIconByVariant = {
  loading: LoaderCircle,
  "not-found": SearchX,
  error: AlertTriangle,
  empty: SearchX,
} satisfies Record<PageStateVariant, typeof AlertTriangle>;

export function PageState({
  variant,
  title,
  description,
  action,
  className,
}: {
  variant: PageStateVariant;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = defaultIconByVariant[variant];

  return (
    <div
      className={cn(
        "mx-auto flex min-h-44 max-w-lg flex-col items-center justify-center rounded-md border border-border bg-card p-6 text-center shadow-soft",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
        <Icon
          className={cn("size-5", variant === "loading" && "motion-safe:animate-spin")}
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </div>
      <h2 className="mt-3 text-sm font-medium text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function PageStateAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      {children}
    </Button>
  );
}
