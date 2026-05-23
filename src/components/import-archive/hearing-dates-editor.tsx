import { makeHearingDate } from "./draft";
import type { ActivityDraft } from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HearingDatesEditor({
  activity,
  updateActivity,
}: {
  activity: ActivityDraft;
  updateActivity: <K extends keyof ActivityDraft>(
    localId: string,
    key: K,
    value: ActivityDraft[K],
  ) => void;
}) {
  const setCount = (count: number) => {
    const normalized = Math.max(0, count);
    const next = activity.hearingDates.slice(0, normalized);
    while (next.length < normalized) next.push(makeHearingDate(activity.activityDate));
    updateActivity(activity.localId, "hearingDates", next);
  };

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="max-w-xs space-y-2">
        <Label>Numero udienze</Label>
        <Input
          type="number"
          min="0"
          step="1"
          value={activity.hearingDates.length}
          onChange={(event) => setCount(Number(event.target.value))}
        />
      </div>
      {activity.hearingDates.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {activity.hearingDates.map((hearingDate, index) => (
            <div key={hearingDate.localId} className="space-y-2">
              <Label>Udienza {index + 1}</Label>
              <Input
                type="date"
                value={hearingDate.date}
                onChange={(event) => {
                  const next = activity.hearingDates.map((current, currentIndex) =>
                    currentIndex === index ? { ...current, date: event.target.value } : current,
                  );
                  updateActivity(activity.localId, "hearingDates", next);
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
