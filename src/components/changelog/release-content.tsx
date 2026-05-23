import { Settings2 } from "lucide-react";
import { AreaGroupList } from "@/components/changelog/area-group-list";
import { CategoryBlock } from "@/components/changelog/category-block";
import {
  countItems,
  groupItemsByArea,
  groupSections,
} from "@/components/changelog/changelog-utils";
import type { ChangelogEntry } from "@/lib/changelog";

export function ReleaseContent({
  entry,
  compact = false,
}: {
  entry: ChangelogEntry;
  compact?: boolean;
}) {
  const groups = groupSections(entry.sections);
  const internalCount = countItems(groups.internal);
  const internalGroups = groupItemsByArea(groups.internal);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {entry.intro && <p className="text-sm text-muted-foreground">{entry.intro}</p>}

      {entry.sections.length === 0 && !entry.intro && (
        <p className="text-sm text-muted-foreground">Nessun dettaglio per questa versione.</p>
      )}

      {groups.highlight.length > 0 && (
        <CategoryBlock category="highlight" sections={groups.highlight} compact={compact} />
      )}
      {groups.fix.length > 0 && (
        <CategoryBlock category="fix" sections={groups.fix} compact={compact} />
      )}
      {groups.internal.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Settings2 className="size-3.5" strokeWidth={1.6} />
            Sotto il cofano · {internalCount} {internalCount === 1 ? "voce" : "voci"}
            <span className="ml-1 text-muted-foreground group-open:hidden">mostra</span>
            <span className="ml-1 hidden text-muted-foreground group-open:inline">nascondi</span>
          </summary>
          <div className="mt-3 space-y-3 border-l-2 border-border/60 pl-4">
            {internalGroups.map((group) => (
              <AreaGroupList
                key={group.area}
                group={group}
                itemClass="text-xs text-muted-foreground/90"
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
