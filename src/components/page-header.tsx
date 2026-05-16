import type { ReactNode } from "react";

type Props = {
  title: string;
  titleAccessory?: ReactNode;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, titleAccessory, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 max-w-full truncate font-display text-[26px] font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {titleAccessory && <div className="shrink-0">{titleAccessory}</div>}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
