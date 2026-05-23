import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseTimelineItemContent } from "@/components/case-timeline-item-content";
import type { CaseTimelineItem } from "@/lib/case-timeline";

export function CaseTimeline({
  timeline,
  isLoading,
  onEditActivity,
}: {
  timeline: CaseTimelineItem[];
  isLoading?: boolean;
  onEditActivity?: (activityId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline pratica</CardTitle>
        <CardDescription>
          Attività, allegati, fatture, cessioni credito e cambi di stato in ordine cronologico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun evento operativo registrato.</p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((item) => (
              <li key={item.id}>
                {item.activityId && onEditActivity ? (
                  <button
                    type="button"
                    className="w-full rounded-md border border-border p-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Modifica attività ${item.title}`}
                    onClick={() => onEditActivity(item.activityId as string)}
                  >
                    <CaseTimelineItemContent item={item} />
                  </button>
                ) : (
                  <div className="rounded-md border border-border p-3">
                    <CaseTimelineItemContent item={item} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
