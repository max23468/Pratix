import { Flag } from "lucide-react";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildDebtCollectionWorkflow, formatCaseWorkflowPriorityLabel } from "@/lib/case-workflow";
import { cn } from "@/lib/utils";

export function WorkflowPriorityBadge({
  workflow,
}: {
  workflow: ReturnType<typeof buildDebtCollectionWorkflow>;
}) {
  const priorityLabel = formatCaseWorkflowPriorityLabel(workflow.priority);

  if (!workflow.priorityInsight) {
    return <Badge variant={workflow.priorityVariant}>{priorityLabel}</Badge>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(badgeVariants({ variant: workflow.priorityVariant }), "cursor-help")}
          aria-label={`Mostra perché questa pratica ${priorityLabel.toLocaleLowerCase("it-IT")}`}
        >
          {priorityLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{workflow.priorityInsight.title}</p>
          <p className="text-sm text-muted-foreground">{workflow.priorityInsight.description}</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {workflow.priorityInsight.items.map((item) => (
            <li key={item} className="flex gap-2">
              <Flag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Azione consigliata</p>
          <p className="mt-1 text-muted-foreground">{workflow.priorityInsight.nextStep}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
