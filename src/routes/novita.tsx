import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/components/app-layout";
import { ReleaseCard } from "@/components/changelog/release-card";
import { ReleasePanel } from "@/components/changelog/release-panel";
import { PageHeader } from "@/components/page-header";
import { releasedChangelog, changelog, type ChangelogEntry } from "@/lib/changelog";
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
  }, [hasUnread, markAsRead]);

  const entries = releasedChangelog.length > 0 ? releasedChangelog : changelog;
  const releaseGroups = splitReleaseGroups(entries);

  return (
    <AppLayout>
      <PageHeader
        title="Novità"
        description="Le ultime modifiche pubblicate per pratiche, attività, fatture e impostazioni."
      />

      <div className="space-y-6">
        {releaseGroups.stable.map((entry) => (
          <ReleaseCard key={entry.version} entry={entry} />
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
              {releaseGroups.prerelease.map((entry) => (
                <ReleasePanel key={entry.version} entry={entry} />
              ))}
            </div>
          </details>
        )}
      </div>
    </AppLayout>
  );
}
