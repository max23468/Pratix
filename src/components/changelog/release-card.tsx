import { ReleaseContent } from "@/components/changelog/release-content";
import { ReleaseHeader } from "@/components/changelog/release-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ChangelogEntry } from "@/lib/changelog";

export function ReleaseCard({ entry }: { entry: ChangelogEntry }) {
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
