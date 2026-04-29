import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { releasedChangelog, changelog } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";
import { useUnreadChangelog } from "@/lib/use-unread-changelog";

export const Route = createFileRoute("/novita")({
  head: () => ({
    meta: [
      { title: "Novità — Pratix" },
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

function NovitaPage() {
  const { markAsRead, hasUnread } = useUnreadChangelog();

  // Quando la pagina si monta, segna la versione corrente come letta.
  useEffect(() => {
    if (hasUnread) markAsRead();
    // markAsRead è stabile (mutation), non serve in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

  // Mostriamo solo le versioni rilasciate. Se non ce n'è ancora, mostriamo
  // il blocco "Non rilasciato" come anteprima dei lavori in corso.
  const entries = releasedChangelog.length > 0 ? releasedChangelog : changelog;

  return (
    <AppLayout>
      <PageHeader
        title="Novità"
        description="Le ultime modifiche pubblicate in Pratix."
      />

      <div className="space-y-4">
        {entries.map((entry, idx) => {
          const isCurrent = entry.version === APP_VERSION;
          const dateLabel = formatDate(entry.date);
          return (
            <Card key={`${entry.version}-${idx}`}>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="font-display text-lg">
                    Versione {entry.version}
                  </CardTitle>
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
                </div>
                {dateLabel && (
                  <p className="text-xs text-muted-foreground">{dateLabel}</p>
                )}
                {entry.intro && (
                  <p className="text-sm text-muted-foreground">{entry.intro}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {entry.sections.length === 0 && !entry.intro && (
                  <p className="text-sm text-muted-foreground">
                    Nessun dettaglio per questa versione.
                  </p>
                )}
                {entry.sections.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    <ul className="space-y-1.5 pl-5 text-sm text-muted-foreground [list-style:disc]">
                      {section.items.map((item, i) => (
                        <li key={i}>
                          <ChangelogItem text={item} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}

/**
 * Render minimale del markdown inline più comune (bold con **).
 * Niente parser pesante: gestiamo solo `**testo**` per evidenziare.
 */
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
