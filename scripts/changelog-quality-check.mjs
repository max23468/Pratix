#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = findRepoRoot();
const changelogPath = path.join(root, "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
const args = parseArgs(process.argv.slice(2));

const allowedSections = new Set([
  "aggiunto",
  "breaking",
  "breaking changes",
  "correzioni",
  "modificato",
  "nessuna release",
  "non rilasciabile",
  "non versionato",
  "novita",
  "rimosso",
  "risolto",
  "sicurezza",
  "sotto il cofano",
]);

const technicalPatterns = [
  { pattern: /\bapi\b/i, hint: "spiega l'integrazione o l'azione visibile, non la API" },
  { pattern: /\bbadge\b/i, hint: "usa 'indicazione', 'etichetta' o descrivi cosa vede l'utente" },
  { pattern: /\bcrud\b/i, hint: "descrivi cosa si puo creare, modificare o consultare" },
  { pattern: /\bendpoint\b/i, hint: "descrivi l'effetto utente dell'endpoint" },
  { pattern: /\bflag\b/i, hint: "usa 'opzione', 'campo' o una frase centrata sull'azione utente" },
  { pattern: /\bmigration\b/i, hint: "metti le migrazioni in Sotto il cofano" },
  { pattern: /\bparser\b/i, hint: "descrivi il comportamento del campo, non il parser" },
  { pattern: /\bpr\s*#?\d+\b/i, hint: "il changelog non deve citare PR" },
  { pattern: /\broute\b/i, hint: "usa 'pagina' o 'percorso' solo se serve all'utente" },
  { pattern: /\bschema\b/i, hint: "metti lo schema in Sotto il cofano" },
  { pattern: /\bsupabase\b/i, hint: "metti dettagli di piattaforma in Sotto il cofano" },
  { pattern: /\btanstack\b/i, hint: "metti dettagli di stack in Sotto il cofano" },
  { pattern: /\bvercel\b/i, hint: "metti dettagli di deploy in Sotto il cofano" },
  {
    pattern: /\b[\w.-]+\.(?:cjs|css|js|jsx|md|mjs|sql|ts|tsx)\b/i,
    hint: "il changelog utente non deve citare file",
  },
  { pattern: /`[^`]+`/, hint: "evita identificatori di codice nelle Novita" },
];

const genericIntroPatterns = [
  {
    pattern: /\brelease\s+di\b/i,
    hint: "apri con cosa cambia per l'utente, non con una formula da release note",
  },
  {
    pattern: /\bconsolidamento operativo\b/i,
    hint: "sostituisci la formula generica con gli effetti concreti",
  },
  {
    pattern: /\b(miglioramenti|ottimizzazioni)\s+vari[ei]\b/i,
    hint: "nomina i cambiamenti principali",
  },
  {
    pattern: /\bpi[uù]\s+centrali\b/i,
    hint: "spiega dove compare o cosa puo fare l'utente",
  },
];

const noveltyPhrasePatterns = [
  {
    pattern: /\bappare\s+subito\b/i,
    hint: "usa un verbo intenzionale, per esempio 'e stata spostata'",
  },
  {
    pattern: /\bgestit[oa]\s+nel\s+campo\b/i,
    hint: "scrivi dove resta l'informazione senza suonare implementativo",
  },
];

const entries = parseEntries(changelog);
const targets = selectTargets(entries, args.target);
const problems = [];

if (targets.length === 0) {
  problems.push("Nessun blocco changelog da controllare.");
}

for (const entry of targets) {
  validateEntry(entry, problems);
}

if (problems.length > 0) {
  console.error("Controllo qualita changelog fallito:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

const targetLabels = targets.map((entry) => entry.version).join(", ");
console.log(`Controllo qualita changelog: ok (${targetLabels}).`);

function parseArgs(argv) {
  const options = { target: "default" };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--target") {
      options.target = argv[++index];
      continue;
    }

    if (arg.startsWith("--target=")) {
      options.target = arg.slice("--target=".length);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(`Uso:
  npm run changelog:check
  npm run changelog:check -- --target unreleased
  npm run changelog:check -- --target latest
  npm run changelog:check -- --target changed
  npm run changelog:check -- --target all`);
      process.exit(0);
    }

    fail(`Argomento non riconosciuto: ${arg}`);
  }

  if (!["all", "changed", "default", "latest", "unreleased"].includes(options.target)) {
    fail(`--target non valido: ${options.target}`);
  }

  return options;
}

function findRepoRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
}

function parseEntries(source) {
  const lines = source.split("\n");
  const headings = [];

  lines.forEach((line, index) => {
    const match = line.match(/^## \[([^\]]+)\](?:\s+—\s+(.+))?\s*$/);
    if (!match) return;

    headings.push({
      date: match[2] ?? "",
      line: index + 1,
      version: match[1],
    });
  });

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const startLine = heading.line;
    const endLine = next ? next.line - 1 : lines.length;
    const body = lines.slice(startLine, endLine).join("\n").trim();

    return {
      ...heading,
      body,
      endLine,
      sections: parseSections(body, startLine),
      startLine,
    };
  });
}

function parseSections(body, bodyStartLine) {
  const lines = body.split("\n");
  const headings = [];

  lines.forEach((line, index) => {
    const match = line.match(/^###\s+(.+?)\s*$/);
    if (!match) return;

    headings.push({
      line: bodyStartLine + index + 1,
      title: match[1],
    });
  });

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const localStart = heading.line - bodyStartLine;
    const localEnd = next ? next.line - bodyStartLine - 1 : lines.length;

    return {
      ...heading,
      body: lines.slice(localStart, localEnd).join("\n").trim(),
      normalizedTitle: normalize(heading.title),
    };
  });
}

function selectTargets(parsedEntries, target) {
  if (target === "all") return parsedEntries.filter(hasBody);

  const selected = [];

  if (target === "unreleased" || target === "default") {
    const unreleased = parsedEntries.find((entry) => normalize(entry.version) === "non rilasciato");
    if (unreleased && (target === "unreleased" || hasBody(unreleased))) {
      selected.push(unreleased);
    }
  }

  if (target === "latest" || target === "default") {
    const latest = parsedEntries.find((entry) => /^\d+\.\d+\.\d+$/.test(entry.version));
    if (latest) selected.push(latest);
  }

  if (target === "changed" || target === "default") {
    for (const changed of changedEntries(parsedEntries)) {
      selected.push(changed);
    }
  }

  return uniqueEntries(selected).filter((entry) => target !== "default" || hasBody(entry));
}

function changedEntries(parsedEntries) {
  const ranges = changedLineRanges();
  if (ranges.length === 0) return [];

  return parsedEntries.filter((entry) =>
    ranges.some((range) => entry.startLine <= range.end && entry.endLine >= range.start),
  );
}

function changedLineRanges() {
  const diffParts = [];

  const comparisonRef = resolveComparisonRef();
  if (comparisonRef) {
    diffParts.push(
      readGitDiff(["diff", "--unified=0", `${comparisonRef}...HEAD`, "--", "CHANGELOG.md"]),
    );
  }

  diffParts.push(readGitDiff(["diff", "--cached", "--unified=0", "--", "CHANGELOG.md"]));
  diffParts.push(readGitDiff(["diff", "--unified=0", "--", "CHANGELOG.md"]));

  const diff = diffParts.filter(Boolean).join("\n");
  if (!diff) return [];

  const ranges = [];

  for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] ? Number(match[2]) : 1;

    if (count > 0) {
      ranges.push({ end: start + count - 1, start });
    }
  }

  return ranges;
}

function readGitDiff(gitArgs) {
  try {
    return execFileSync("git", gitArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function resolveComparisonRef() {
  try {
    return execFileSync(
      "git",
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    for (const ref of ["origin/main", "main"]) {
      try {
        execFileSync("git", ["rev-parse", "--verify", ref], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        return ref;
      } catch {
        // Try the next default base.
      }
    }
  }

  return "";
}

function validateEntry(entry, output) {
  for (const section of entry.sections) {
    if (!allowedSections.has(section.normalizedTitle)) {
      output.push(
        `${entryLabel(entry)} riga ${section.line}: sezione "${section.title}" non riconosciuta.`,
      );
    }
  }

  validateIntro(entry, output);

  const novita = entry.sections.find((section) => section.normalizedTitle === "novita");
  if (!novita || !sectionHasText(novita.body)) return;

  validateNovitaSection(entry, novita, output);
}

function validateIntro(entry, output) {
  const intro = entry.body.split(/^###\s+.+$/m)[0].trim();
  if (!intro) return;

  for (const rule of genericIntroPatterns) {
    if (rule.pattern.test(intro)) {
      output.push(`${entryLabel(entry)} introduzione: ${rule.hint}.`);
    }
  }

  for (const sentence of splitSentences(intro)) {
    if (wordCount(sentence) > 24) {
      output.push(`${entryLabel(entry)} introduzione: frase troppo lunga, spezzala.`);
    }
  }
}

function validateNovitaSection(entry, section, output) {
  const bullets = extractBullets(section.body, section.line);

  if (bullets.length === 0) {
    output.push(`${entryLabel(entry)} riga ${section.line}: la sezione Novita deve usare bullet.`);
    return;
  }

  for (const bullet of bullets) {
    if (!/^- \*\*[^*]+?\*\*:\s+\S/.test(bullet.raw)) {
      output.push(
        `${entryLabel(entry)} riga ${bullet.line}: in Novita usa il formato "- **Area**: cosa cambia".`,
      );
    }

    for (const rule of technicalPatterns) {
      if (rule.pattern.test(bullet.text)) {
        output.push(`${entryLabel(entry)} riga ${bullet.line}: ${rule.hint}.`);
      }
    }

    for (const rule of noveltyPhrasePatterns) {
      if (rule.pattern.test(bullet.text)) {
        output.push(`${entryLabel(entry)} riga ${bullet.line}: ${rule.hint}.`);
      }
    }

    for (const sentence of splitSentences(stripBulletPrefix(bullet.text))) {
      if (wordCount(sentence) > 30) {
        output.push(`${entryLabel(entry)} riga ${bullet.line}: frase troppo lunga, spezzala.`);
      }
    }
  }
}

function extractBullets(sectionBody, sectionLine) {
  const lines = sectionBody.split("\n");
  const bullets = [];
  let current = null;

  lines.forEach((line, index) => {
    if (line.startsWith("- ")) {
      if (current) bullets.push(current);
      current = { line: sectionLine + index + 1, rawLines: [line] };
      return;
    }

    if (current && (line.startsWith("  ") || line.trim() === "")) {
      current.rawLines.push(line);
    }
  });

  if (current) bullets.push(current);

  return bullets.map((bullet) => {
    const raw = bullet.rawLines.join("\n");

    return {
      line: bullet.line,
      raw,
      text: raw.replace(/\s+/g, " ").trim(),
    };
  });
}

function splitSentences(text) {
  return text
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function stripBulletPrefix(text) {
  return text.replace(/^- \*\*[^*]+?\*\*:\s*/, "");
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function sectionHasText(body) {
  return body.split("\n").some((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("<!--");
  });
}

function hasBody(entry) {
  return sectionHasText(entry.body);
}

function uniqueEntries(targets) {
  return [...new Map(targets.map((entry) => [entry.version, entry])).values()];
}

function entryLabel(entry) {
  return `[${entry.version}]`;
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function fail(message) {
  console.error(`Errore changelog: ${message}`);
  process.exit(1);
}
