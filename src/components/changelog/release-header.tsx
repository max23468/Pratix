import { Badge } from "@/components/ui/badge";
import { formatChangelogDate } from "@/components/changelog/changelog-utils";
import type { ChangelogEntry } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";

export function ReleaseHeader({
  entry,
  compact = false,
}: {
  entry: ChangelogEntry;
  compact?: boolean;
}) {
  const isCurrent = entry.version === APP_VERSION;
  const dateLabel = formatChangelogDate(entry.date);
  const Heading = compact ? "h3" : "h2";

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <Heading
        className={
          compact
            ? "font-display text-base font-semibold text-foreground"
            : "font-display text-xl font-semibold text-foreground"
        }
      >
        v{entry.version}
      </Heading>
      {isCurrent && (
        <Badge variant="secondary" className="text-xs">
          In uso
        </Badge>
      )}
      {entry.unreleased && (
        <Badge variant="outline" className="text-xs">
          In preparazione
        </Badge>
      )}
      {dateLabel && <span className="text-xs text-muted-foreground">{dateLabel}</span>}
    </div>
  );
}
