#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const changelogPath = path.join(root, "CHANGELOG.md");
const versionPath = path.join(root, "src/lib/version.ts");

const validBumps = new Set(["major", "minor", "patch"]);

function parseArgs(argv) {
  const options = {
    bump: null,
    date: null,
    dryRun: false,
    help: false,
    version: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg.startsWith("--bump=")) {
      options.bump = arg.slice("--bump=".length);
      continue;
    }

    if (arg === "--bump") {
      options.bump = argv[++i];
      continue;
    }

    if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length);
      continue;
    }

    if (arg === "--version") {
      options.version = argv[++i];
      continue;
    }

    if (arg.startsWith("--date=")) {
      options.date = arg.slice("--date=".length);
      continue;
    }

    if (arg === "--date") {
      options.date = argv[++i];
      continue;
    }

    if (!options.bump && validBumps.has(arg)) {
      options.bump = arg;
      continue;
    }

    fail(`Argomento non riconosciuto: ${arg}`);
  }

  return options;
}

function showHelp() {
  console.log(`Uso:
  npm run release
  npm run release -- --dry-run
  npm run release -- --bump patch
  npm run release -- --version 0.4.0
  npm run release -- --date 2026-05-02

Senza --bump o --version, il bump viene inferito da CHANGELOG.md:
  major  se [Non rilasciato] contiene sezioni breaking o Rimosso
  minor  se contiene Novità o Aggiunto
  patch  negli altri casi`);
}

function fail(message) {
  console.error(`Errore release: ${message}`);
  process.exit(1);
}

function todayInRome() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function readCurrentVersion(source) {
  const versionMatch = source.match(/export const APP_VERSION = "([^"]+)";/);
  const dateMatch = source.match(/export const BUILD_DATE = "([^"]+)";/);

  if (!versionMatch) fail("APP_VERSION non trovato in src/lib/version.ts.");
  if (!dateMatch) fail("BUILD_DATE non trovato in src/lib/version.ts.");

  return {
    buildDate: dateMatch[1],
    version: versionMatch[1],
  };
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) fail(`Versione SemVer non valida: ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }

  return 0;
}

function bumpVersion(currentVersion, bump) {
  const [major, minor, patch] = parseVersion(currentVersion);

  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;

  fail(`Bump non valido: ${bump}`);
}

function extractUnreleased(changelog) {
  const headerRegex = /^## \[Non rilasciato\]\s*$/m;
  const headerMatch = changelog.match(headerRegex);

  if (!headerMatch || headerMatch.index === undefined) {
    fail("Blocco ## [Non rilasciato] non trovato in CHANGELOG.md.");
  }

  const bodyStart = headerMatch.index + headerMatch[0].length;
  const afterHeader = changelog.slice(bodyStart);
  const nextHeaderIndex = afterHeader.search(/\n## \[[^\]]+\]/);

  if (nextHeaderIndex === -1) {
    fail("Nessuna release esistente trovata dopo ## [Non rilasciato].");
  }

  const rawBody = afterHeader.slice(0, nextHeaderIndex);
  const body = rawBody.trim();

  if (!body) {
    fail("Il blocco [Non rilasciato] è vuoto. Aggiungi almeno una voce prima di rilasciare.");
  }

  return {
    afterHeader,
    beforeHeader: changelog.slice(0, headerMatch.index),
    body,
    rest: afterHeader.slice(nextHeaderIndex),
  };
}

function inferBump(unreleasedBody) {
  const sectionTitles = [...unreleasedBody.matchAll(/^###\s+(.+)$/gm)].map((match) =>
    normalize(match[1]),
  );
  const normalizedBody = normalize(unreleasedBody);

  if (
    sectionTitles.some((title) => ["breaking", "breaking changes", "rimosso"].includes(title)) ||
    /\bbreaking change\b/.test(normalizedBody)
  ) {
    return "major";
  }

  if (sectionTitles.some((title) => ["novita", "aggiunto"].includes(title))) {
    return "minor";
  }

  return "patch";
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function changelogAnchor(version, date) {
  return `#${version.replace(/\./g, "")}--${date}`;
}

function updateChangelog(changelog, release) {
  if (changelog.includes(`## [${release.version}]`)) {
    fail(`CHANGELOG.md contiene già una release ${release.version}.`);
  }

  if (changelog.includes(`[${release.version}]:`)) {
    fail(`CHANGELOG.md contiene già un link per ${release.version}.`);
  }

  const unreleased = extractUnreleased(changelog);
  const nextChangelog = `${unreleased.beforeHeader}## [Non rilasciato]\n\n## [${release.version}] — ${release.date}\n\n${unreleased.body}\n${unreleased.rest}`;
  const releaseLink = `[${release.version}]: ${changelogAnchor(release.version, release.date)}`;

  return nextChangelog.replace(
    /^\[Non rilasciato\]: #non-rilasciato$/m,
    `[Non rilasciato]: #non-rilasciato\n${releaseLink}`,
  );
}

function updateVersionFile(source, release) {
  return source
    .replace(
      /export const APP_VERSION = "[^"]+";/,
      `export const APP_VERSION = "${release.version}";`,
    )
    .replace(/export const BUILD_DATE = "[^"]+";/, `export const BUILD_DATE = "${release.date}";`);
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  showHelp();
  process.exit(0);
}

if (options.bump && !validBumps.has(options.bump)) {
  fail(`--bump deve essere major, minor o patch. Ricevuto: ${options.bump}`);
}

if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
  fail(`--date deve usare il formato YYYY-MM-DD. Ricevuto: ${options.date}`);
}

if (options.version && !/^\d+\.\d+\.\d+$/.test(options.version)) {
  fail(`--version deve usare il formato X.Y.Z. Ricevuto: ${options.version}`);
}

const changelog = readFileSync(changelogPath, "utf8");
const versionFile = readFileSync(versionPath, "utf8");
const current = readCurrentVersion(versionFile);
const unreleased = extractUnreleased(changelog);
const bump = options.bump ?? (options.version ? null : inferBump(unreleased.body));
const nextVersion = options.version ?? bumpVersion(current.version, bump);
const releaseDate = options.date ?? todayInRome();

if (compareVersions(nextVersion, current.version) <= 0) {
  fail(
    `La nuova versione (${nextVersion}) deve essere maggiore della versione corrente (${current.version}).`,
  );
}

const nextChangelog = updateChangelog(changelog, {
  date: releaseDate,
  version: nextVersion,
});
const nextVersionFile = updateVersionFile(versionFile, {
  date: releaseDate,
  version: nextVersion,
});

const inferred = bump ? `bump ${bump}` : "versione esplicita";

if (options.dryRun) {
  console.log(`Dry-run release Pratix ${nextVersion} (${releaseDate})`);
  console.log(`Versione corrente: ${current.version} (${current.buildDate})`);
  console.log(`Strategia: ${inferred}`);
  console.log("File che verrebbero aggiornati:");
  console.log("- CHANGELOG.md");
  console.log("- src/lib/version.ts");
  process.exit(0);
}

writeFileSync(changelogPath, nextChangelog);
writeFileSync(versionPath, nextVersionFile);

console.log(`Release Pratix ${nextVersion} preparata (${releaseDate}, ${inferred}).`);
console.log("Aggiornati CHANGELOG.md e src/lib/version.ts.");
