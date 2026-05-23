import { ReleaseContent } from "@/components/changelog/release-content";
import { ReleaseHeader } from "@/components/changelog/release-header";
import type { ChangelogEntry } from "@/lib/changelog";

export function ReleasePanel({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="rounded-md border border-border/60 bg-background p-4">
      <ReleaseHeader entry={entry} compact />
      <div className="mt-4">
        <ReleaseContent entry={entry} compact />
      </div>
    </div>
  );
}
