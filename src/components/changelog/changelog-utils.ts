import { Settings2, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import type { ChangelogSection } from "@/lib/changelog";

export type Category = "highlight" | "fix" | "internal";

export const CATEGORY_META: Record<
  Category,
  { label: string; icon: typeof Sparkles; tone: string }
> = {
  highlight: { label: "Novità", icon: Sparkles, tone: "text-brand-gold" },
  fix: { label: "Correzioni", icon: Wrench, tone: "text-foreground" },
  internal: { label: "Sotto il cofano", icon: Settings2, tone: "text-muted-foreground" },
};

export type GroupedSections = {
  highlight: ChangelogSection[];
  fix: ChangelogSection[];
  internal: ChangelogSection[];
};

export type AreaGroup = {
  area: string;
  items: string[];
};

export function formatChangelogDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export function groupSections(sections: ChangelogSection[]): GroupedSections {
  const out: GroupedSections = { highlight: [], fix: [], internal: [] };
  for (const section of sections) out[categorize(section.title)].push(section);
  return out;
}

export function countItems(sections: ChangelogSection[]): number {
  return sections.reduce((acc, section) => acc + section.items.length, 0);
}

export function sectionIcon(sections: ChangelogSection[]) {
  return sections.some((section) => /sicurez/i.test(section.title)) ? ShieldCheck : Wrench;
}

export function groupItemsByArea(sections: ChangelogSection[]): AreaGroup[] {
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

export function splitChangelogItem(text: string) {
  const parts: Array<{ key: string; part: string }> = [];
  const boldPattern = /\*\*[^*]+\*\*/g;
  let cursor = 0;
  for (const match of text.matchAll(boldPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      const part = text.slice(cursor, index);
      parts.push({ key: `${cursor}:${part}`, part });
    }
    const part = match[0];
    parts.push({ key: `${index}:${part}`, part });
    cursor = index + part.length;
  }
  if (cursor < text.length) {
    const part = text.slice(cursor);
    parts.push({ key: `${cursor}:${part}`, part });
  }
  return parts;
}

function categorize(title: string): Category {
  const text = title.toLowerCase();
  if (/novit|aggiun/.test(text)) return "highlight";
  if (/correz|corret|sicurez|fix|bug|rimoss|deprec/.test(text)) return "fix";
  if (/cofano|interno|tecnic|refactor|build|chore/.test(text)) return "internal";
  if (/modific|aggiorn/.test(text)) return "fix";
  return "fix";
}

function extractArea(text: string): { area: string; item: string } {
  const match = text.match(/^\*\*([^*]+)\*\*:\s*(.+)$/);
  if (!match) return { area: "Generale", item: text };
  return { area: match[1].trim(), item: match[2].trim() };
}
