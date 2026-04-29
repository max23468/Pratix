import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sparkles, Wrench, Settings2, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  releasedChangelog,
  changelog,
  type ChangelogSection,
} from "@/lib/changelog";
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

/**
 * Categoria visiva di una sezione del changelog.
 * - "highlight": novità rilevanti per l'utente (in evidenza)
 * - "fix": correzioni e sicurezza (normali, compatte)
 * - "internal": refactor, asset, build, migrazioni invisibili (collassato)
 */
type Category = "highlight" | "fix" | "internal";

const CATEGORY_META: Record<
  Category,
  { label: string; icon: typeof Sparkles; tone: string }
> = {
  highlight: {
    label: "Novità",
    icon: Sparkles,
    tone: "text-brand-gold",
  },
  fix: {
    label: "Correzioni",
    icon: Wrench,
    tone: "text-foreground",
  },
  internal: {
    label: "Sotto il cofano",
    icon: Settings2,
    tone: "text-muted-foreground",
  },
};

/**
 * Mappa il titolo grezzo della sezione (Markdown `### ...`) a una categoria.
 * Accetta sia la nuova convenzione (`Novità` / `Correzioni` / `Sotto il cofano`)
 * sia quella vecchia di Keep a Changelog (`Aggiunto` / `Modificato` /
 * `Sicurezza` / `Corretto` / `Rimosso` / `Deprecato`) per non perdere lo
 * storico delle versioni già rilasciate.
 */
function categorize(title: string): Category {
  const t = title.toLowerCase();
  if (/novit|aggiun/.test(t)) return "highlight";
  if (/correz|corret|sicurez|fix|bug|rimoss|deprec/.test(t)) return "fix";
  if (/cofano|interno|tecnic|refactor|build|chore/.test(t)) return "internal";
  // "Modificato" è ambiguo: lo trattiamo come correzione/cambio minore.
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

/** Conteggio item totali in un gruppo. */
function countItems(sections: ChangelogSection[]): number {
  return sections.reduce((acc, s) => acc + s.items.length, 0);
}

function NovitaPage() {
  const { markAsRead, hasUnread } = useUnreadChangelog();

  useEffect(() => {
    if (hasUnread) markAsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

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
          const groups = groupSections(entry.sections);
          const internalCount = countItems(groups.internal);

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
              <CardContent className="space-y-6">
                {entry.sections.length === 0 && !entry.intro && (
                  <p className="text-sm text-muted-foreground">
                    Nessun dettaglio per questa versione.
                  </p>
                )}

                {/* Novità — in evidenza */}
                {groups.highlight.length > 0 && (
                  <CategoryBlock category="highlight" sections={groups.highlight} />
                )}

                {/* Correzioni — compatte */}
                {groups.fix.length > 0 && (
                  <CategoryBlock category="fix" sections={groups.fix} />
                )}

                {/* Sotto il cofano — collassato */}
                {groups.internal.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                      <Settings2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      Sotto il cofano · {internalCount}{" "}
                      {internalCount === 1 ? "voce" : "voci"}
                      <span className="ml-1 text-muted-foreground/70 group-open:hidden">
                        mostra
                      </span>
                      <span className="ml-1 hidden text-muted-foreground/70 group-open:inline">
                        nascondi
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3 border-l-2 border-border/60 pl-4">
                      {groups.internal.map((section) => (
                        <SectionList
                          key={section.title}
                          section={section}
                          itemClass="text-xs text-muted-foreground/90"
                        />
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}

function CategoryBlock({
  category,
  sections,
}: {
  category: Category;
  sections: ChangelogSection[];
}) {
  const meta = CATEGORY_META[category];
  const Icon = category === "fix" ? sectionIcon(sections) : meta.icon;
  const isHighlight = category === "highlight";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${meta.tone}`} strokeWidth={1.8} />
        <h3
          className={
            isHighlight
              ? "font-display text-sm font-semibold text-foreground"
              : "text-sm font-semibold text-foreground"
          }
        >
          {meta.label}
        </h3>
      </div>
      <div className={isHighlight ? "space-y-2" : "space-y-1.5"}>
        {sections.map((section) => (
          <SectionList
            key={section.title}
            section={section}
            itemClass={
              isHighlight
                ? "text-sm text-foreground"
                : "text-sm text-muted-foreground"
            }
          />
        ))}
      </div>
    </div>
  );
}

/** Se almeno una sezione è "Sicurezza", usa lo scudo invece della chiave. */
function sectionIcon(sections: ChangelogSection[]) {
  return sections.some((s) => /sicurez/i.test(s.title)) ? ShieldCheck : Wrench;
}

function SectionList({
  section,
  itemClass,
}: {
  section: ChangelogSection;
  itemClass: string;
}) {
  return (
    <ul className="space-y-1.5 pl-5 [list-style:disc] marker:text-muted-foreground/50">
      {section.items.map((item, i) => (
        <li key={i} className={itemClass}>
          <ChangelogItem text={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Render minimale del markdown inline più comune (bold con **).
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
