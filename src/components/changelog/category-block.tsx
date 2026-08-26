import { AreaGroupList } from "@/components/changelog/area-group-list";
import { Settings2, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import {
  CATEGORY_META,
  groupItemsByArea,
  sectionIcon,
  type Category,
} from "@/components/changelog/changelog-utils";
import type { ChangelogSection } from "@/lib/changelog";

export function CategoryBlock({
  category,
  sections,
  compact = false,
}: {
  category: Category;
  sections: ChangelogSection[];
  compact?: boolean;
}) {
  const meta = CATEGORY_META[category];
  const isSecurityFix = category === "fix" && sectionIcon(sections) === ShieldCheck;
  const isHighlight = category === "highlight";
  const areaGroups = groupItemsByArea(sections);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {isSecurityFix ? (
          <ShieldCheck className={`size-4 ${meta.tone}`} strokeWidth={1.8} />
        ) : category === "highlight" ? (
          <Sparkles className={`size-4 ${meta.tone}`} strokeWidth={1.8} />
        ) : category === "internal" ? (
          <Settings2 className={`size-4 ${meta.tone}`} strokeWidth={1.8} />
        ) : (
          <Wrench className={`size-4 ${meta.tone}`} strokeWidth={1.8} />
        )}
        <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
      </div>
      <div className={isHighlight ? "space-y-3" : "space-y-2.5"}>
        {areaGroups.map((group) => (
          <AreaGroupList
            key={group.area}
            group={group}
            itemClass={
              isHighlight && !compact ? "text-sm text-foreground" : "text-sm text-muted-foreground"
            }
          />
        ))}
      </div>
    </div>
  );
}
