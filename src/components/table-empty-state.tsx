import type { ReactNode } from "react";

type TableEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function TableEmptyState({ title, description, action }: TableEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-3 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
