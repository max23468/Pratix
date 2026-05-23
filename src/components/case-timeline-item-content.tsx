import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CaseTimelineItem } from "@/lib/case-timeline";

export function CaseTimelineItemContent({ item }: { item: CaseTimelineItem }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{item.title}</p>
          <Badge variant="outline">{item.meta}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
        {item.amount ? <p className="text-sm font-medium">{formatCurrency(item.amount)}</p> : null}
      </div>
    </div>
  );
}
