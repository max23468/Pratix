import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sparkles, Wrench, Settings2, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  releasedChangelog,
  changelog,
  type ChangelogSection,
  type ChangelogEntry,
} from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";
import { useUnreadChangelog } from "@/lib/use-unread-changelog";

export const Route = createFileRoute("/novita")({
  head: () => ({
    meta: [
      { title: "Novità · Pratix" },
      { name: "description", content: "Cosa è cambiato di recente in Pratix." },
    ],
  }),
  component: NovitaPage,
});

function formatDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

/* -------------------------------------------------------------------------- */
/* Categorie sezione                                                          */
/* -------------------------------------------------------------------------- */

type Category = "highlight" | "fix" | "internal";

const CATEGORY_META: Record<Category, { label: string; icon: typeof Sparkles; tone: string }> = {
  highlight: { label: "Novità", icon: Sparkles, tone: "text-brand-gold" },
  fix: { label: "Correzioni", icon: Wrench, tone: "text-foreground" },
  internal: { label: "Sotto il cofano", icon: Settings2, tone: "text-muted-foreground" },
};

function categorize(title: string): Category {
  const t = title.toLowerCase();
  if (/novit|aggiun/.test(t)) return "highlight";
  if (/correz|corret|sicurez|fix|bug|rimoss|deprec/.test(t)) return "fix";
  if (/cofano|interno|tecnic|refactor|build|chore/.test(t)) return "internal";
  if (/modific|aggiorn/.test(t)) return "fix";
  return "fix";
}

type GroupedSections = {
  highlight: ChangelogSection[];
  fix: ChangelogSection[];
  internal: ChangelogSection[];
};

function groupSections(sections: ChangelogSection[]): GroupedSections {
  const out: GroupedSections = { highlight: [], fix: [], internal: [] };
  for (const s of sections) out[categorize(s.title)].push(s);
  return out;
}

function countItems(sections: ChangelogSection[]): number {
  return sections.reduce((acc, s) => acc + s.items.length, 0);
}

/* -------------------------------------------------------------------------- */
/* Raggruppamento per maturità release                                        */
/* -------------------------------------------------------------------------- */

type ReleaseGroups = {
  stable: ChangelogEntry[];
  prerelease: ChangelogEntry[];
};

function isPrereleaseVersion(version: string): boolean {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isFinite(major) && major < 1;
}

function splitReleaseGroups(entries: ChangelogEntry[]): ReleaseGroups {
  return entries.reduce<ReleaseGroups>(
    (groups, entry) => {
      if (isPrereleaseVersion(entry.version)) {
        groups.prerelease.push(entry);
      } else {
        groups.stable.push(entry);
      }
      return groups;
    },
    { stable: [], prerelease: [] },
  );
}

/* -------------------------------------------------------------------------- */
/* Pagina                                                                     */
/* -------------------------------------------------------------------------- */

function NovitaPage() {
  const { markAsRead, hasUnread } = useUnreadChangelog();

  useEffect(() => {
    if (hasUnread) markAsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

  const entries = releasedChangelog.length > 0 ? releasedChangelog : changelog;
  const releaseGroups = splitReleaseGroups(entries);

  return (
    <AppLayout>
      <PageHeader
        title="Novità"
        description="Le ultime modifiche pubblicate per pratiche, attività, fatture e impostazioni."
      />

      <div className="space-y-6">
        {releaseGroups.stable.map((entry, index) => (
          <ReleaseCard key={`${entry.version}-${index}`} entry={entry} />
        ))}

        {releaseGroups.prerelease.length > 0 && (
          <details className="group rounded-md border border-border/60 bg-muted/30">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
              <span className="font-display text-foreground">Versioni pre-1.0</span>
              <span>
                {releaseGroups.prerelease.length}{" "}
                {releaseGroups.prerelease.length === 1 ? "versione" : "versioni"}
              </span>
              <span className="ml-auto text-xs group-open:hidden">mostra</span>
              <span className="ml-auto hidden text-xs group-open:inline">nascondi</span>
            </summary>
            <div className="space-y-4 border-t border-border/60 px-4 py-5">
              {releaseGroups.prerelease.map((entry, index) => (
                <ReleasePanel key={`${entry.version}-${index}`} entry={entry} />
              ))}
            </div>
          </details>
        )}
      </div>
    </AppLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Blocco di una singola release                                              */
/* -------------------------------------------------------------------------- */

function ReleaseCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <Card>
      <CardHeader className="space-y-1.5 pb-4">
        <ReleaseHeader entry={entry} />
      </CardHeader>
      <CardContent>
        <ReleaseContent entry={entry} />
      </CardContent>
    </Card>
  );
}

function ReleasePanel({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="rounded-md border border-border/60 bg-background px-4 py-4">
      <ReleaseHeader entry={entry} compact />
      <div className="mt-4">
        <ReleaseContent entry={entry} compact />
      </div>
    </div>
  );
}

function ReleaseHeader({ entry, compact = false }: { entry: ChangelogEntry; compact?: boolean }) {
  const isCurrent = entry.version === APP_VERSION;
  const dateLabel = formatDate(entry.date);
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

function ReleaseContent({ entry, compact = false }: { entry: ChangelogEntry; compact?: boolean }) {
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

function CategoryBlock({
  category,
  sections,
  compact = false,
}: {
  category: Category;
  sections: ChangelogSection[];
  compact?: boolean;
}) {
  const meta = CATEGORY_META[category];
  const Icon = category === "fix" ? sectionIcon(sections) : meta.icon;
  const isHighlight = category === "highlight";
  const areaGroups = groupItemsByArea(sections);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${meta.tone}`} strokeWidth={1.8} />
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

function sectionIcon(sections: ChangelogSection[]) {
  return sections.some((s) => /sicurez/i.test(s.title)) ? ShieldCheck : Wrench;
}

type AreaGroup = {
  area: string;
  items: string[];
};

function extractArea(text: string): { area: string; item: string } {
  const match = text.match(/^\*\*([^*]+)\*\*:\s*(.+)$/);
  if (!match) return { area: "Generale", item: text };
  return { area: match[1].trim(), item: match[2].trim() };
}

function groupItemsByArea(sections: ChangelogSection[]): AreaGroup[] {
  const groups = new Map<string, string[]>();
  for (const section of sections) {
    for (const item of section.items) {
      const parsed = extractArea(item);
      if (!groups.has(parsed.area)) groups.set(parsed.area, []);
      groups.get(parsed.area)!.push(parsed.item);
    }
  }
  return [...groups.entries()].map(([area, items]) => ({ area, items }));
}

function AreaGroupList({ group, itemClass }: { group: AreaGroup; itemClass: string }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {group.area}
      </h4>
      <ul className="space-y-1.5 pl-5 [list-style:disc] marker:text-muted-foreground/50">
        {group.items.map((item, i) => (
          <li key={i} className={itemClass}>
            <ChangelogItem text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangelogItem({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-medium text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
