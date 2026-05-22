// Importa il CHANGELOG.md come stringa raw, in modo che sia bundlato a build time.
// Vite supporta nativamente l'import ?raw.
import changelogRaw from "../../CHANGELOG.md?raw";

export type ChangelogSection = {
  /** Es. "Aggiunto", "Modificato", "Sicurezza" */
  title: string;
  /** Item della sezione, già "puliti" (senza il bullet markdown) */
  items: string[];
};

export type ChangelogEntry = {
  /** Es. "0.2.0" oppure "Non rilasciato" */
  version: string;
  /** Data in formato YYYY-MM-DD, oppure null se non rilasciata */
  date: string | null;
  /** True se la voce è "Non rilasciato" */
  unreleased: boolean;
  /** True se la voce contiene note interne non pubblicabili in `/novita` */
  nonVersioned: boolean;
  /** Eventuale paragrafo introduttivo (riga di descrizione sotto al titolo) */
  intro?: string;
  /** Sezioni "### Aggiunto", "### Modificato", ecc. */
  sections: ChangelogSection[];
};

/**
 * Parser semplice e tollerante per il formato Keep a Changelog usato in CHANGELOG.md.
 * Riconosce blocchi del tipo:
 *
 *   ## [0.2.0] — 2026-04-29
 *   intro opzionale
 *   ### Aggiunto
 *   - voce
 *   - voce
 *
 * Si ferma al primo `---` di chiusura sezione o alla fine del file.
 */
export function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  // Match `## [versione] — data` oppure `## [versione]`
  const headerRegex = /^##\s+\[([^\]]+)\](?:\s+[—–-]\s+(\d{4}-\d{2}-\d{2}))?/gm;
  const matches = [...raw.matchAll(headerRegex)];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    let body = raw.slice(start, end).trim();

    // Tronca al separatore `---` se presente
    const sepIdx = body.indexOf("\n---");
    if (sepIdx !== -1) body = body.slice(0, sepIdx).trim();

    const version = m[1].trim();
    const date = m[2] ?? null;
    const unreleased = /non\s+rilasciato/i.test(version);
    const nonVersioned = /non\s+versionato/i.test(version);

    // Trova le sezioni `### Titolo`
    const sectionRegex = /^###\s+(.+)$/gm;
    const sectionMatches = [...body.matchAll(sectionRegex)];

    let intro: string | undefined;
    if (sectionMatches.length > 0) {
      intro = body.slice(0, sectionMatches[0].index!).trim() || undefined;
    } else {
      intro = body.trim() || undefined;
    }

    const sections: ChangelogSection[] = sectionMatches.map((sm, j) => {
      const sStart = sm.index! + sm[0].length;
      const sEnd = j + 1 < sectionMatches.length ? sectionMatches[j + 1].index! : body.length;
      const sBody = body.slice(sStart, sEnd).trim();
      const items = parseSectionItems(sBody);
      return { title: sm[1].trim(), items };
    });

    entries.push({ version, date, unreleased, nonVersioned, intro, sections });
  }

  return entries;
}

function parseSectionItems(sectionBody: string): string[] {
  const items: string[] = [];
  let current: string[] = [];

  for (const line of sectionBody.split("\n")) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);

    if (bulletMatch) {
      pushCurrentItem();
      current = [bulletMatch[1].trim()];
      continue;
    }

    if (current.length > 0 && line.trim()) {
      current.push(line.trim());
    }
  }

  pushCurrentItem();
  return items;

  function pushCurrentItem() {
    if (current.length === 0) return;

    const item = current.join(" ").replace(/\s+/g, " ").trim();
    if (item) items.push(item);
    current = [];
  }
}

/** Versioni del changelog, già parsate. */
export const changelog: ChangelogEntry[] = parseChangelog(changelogRaw);

/** Versioni effettivamente rilasciate nella UI (esclude bozze e note interne). */
export const releasedChangelog: ChangelogEntry[] = changelog.filter(
  (e) => !e.unreleased && !e.nonVersioned,
);

/**
 * Confronto SemVer base (a > b → 1, a < b → -1, uguali → 0).
 * Tollerante: voci non parsabili contano come 0.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

/**
 * Ritorna true se la `current` è più recente della `lastSeen` (o se l'utente
 * non ha mai visto nulla). `lastSeen` può essere null o stringa vuota.
 */
export function hasUnreadChangelog(current: string, lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return true;
  return compareVersions(current, lastSeen) > 0;
}
