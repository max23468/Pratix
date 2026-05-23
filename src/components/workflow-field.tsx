import { Flag } from "lucide-react";

export function WorkflowField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Flag className="size-3" />
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
