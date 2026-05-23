import { ChangelogItem } from "@/components/changelog/changelog-item";
import type { AreaGroup } from "@/components/changelog/changelog-utils";

export function AreaGroupList({ group, itemClass }: { group: AreaGroup; itemClass: string }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {group.area}
      </h4>
      <ul className="space-y-1.5 pl-5 [list-style:disc] marker:text-muted-foreground/50">
        {group.items.map((item) => (
          <li key={`${group.area}-${item}`} className={itemClass}>
            <ChangelogItem text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
