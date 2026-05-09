import type { ReactNode } from "react";

type TableEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function TableEmptyState({ title, description, action, icon }: TableEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-4 text-center">
      {icon && (
        <div className="mb-1 flex size-10 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
