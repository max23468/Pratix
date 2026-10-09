import { type PracticeWorkflowRow } from "@/components/practices/types";
import { Badge } from "@/components/ui/badge";

export function PracticeWorkflowSummary({ workflow }: { workflow: PracticeWorkflowRow }) {
  return (
    <div className="mt-3 rounded-md border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={workflow.priorityVariant}>{workflow.priorityLabel}</Badge>
        <span className="text-xs text-muted-foreground">{workflow.stage}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{workflow.action}</p>
      <p className="mt-1 text-xs text-muted-foreground">{workflow.reason}</p>
    </div>
  );
}
