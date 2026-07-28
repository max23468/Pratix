#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = execGit(["rev-parse", "--show-toplevel"], process.cwd());
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  showHelp();
  process.exit(0);
}

const branch = execGit(["branch", "--show-current"], root) || "(detached HEAD)";
const upstream = tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], root);
const baseRef = resolvePublicationBase({ branch, upstream });
const changedFiles = getChangedFiles(baseRef);
const statusLines = lines(execGit(["status", "--short"], root));
const unreleased = readUnreleasedBlock();
const releaseAdvice = classifyUnreleased(unreleased.body);
const packageImpact = inspectPackageImpact(baseRef);
const categories = classifyChangedFiles(changedFiles, releaseAdvice, packageImpact);
const dependencyState = inspectDependencies();
const lane = classifyPublishLane(categories);
const checks = buildChecks({ categories, changedFiles, lane });

printReport({
  baseRef,
  branch,
  categories,
  changedFiles,
  checks,
  dependencyState,
  lane,
  releaseAdvice,
  statusLines,
  upstream,
  unreleased,
});

if (args.runChecks) {
  if (!dependencyState.nodeModulesPresent) {
    fail("node_modules non trovato. Esegui prima npm run setup in questo worktree.");
  }

  run("npm", ["run", "prepush:guard"]);
}

function parseArgs(argv) {
  const options = {
    help: false,
    runChecks: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--run-checks") {
      options.runChecks = true;
      continue;
    }

    fail(`Argomento non riconosciuto: ${arg}`);
  }

  return options;
}

function showHelp() {
  console.log(`Uso:
  npm run publish:prepare
  npm run publish:prepare -- --run-checks

Il comando prepara la pubblicazione senza modificare file:
  - mostra branch, upstream e base di confronto;
  - controlla se node_modules manca nel worktree;
  - classifica il diff per capire release, Vercel e smoke necessari;
  - legge il blocco CHANGELOG.md [Non rilasciato];
  - propone i prossimi comandi operativi.

Con --run-checks esegue anche npm run prepush:guard.`);
}

function printReport(report) {
  section("Preparazione pubblicazione Pratix");
  item("Branch", report.branch);
  item("Upstream", report.upstream || "non configurato");
  item("Base diff", report.baseRef || "HEAD");
  item(
    "Stato",
    report.statusLines.length ? `${report.statusLines.length} righe in git status` : "pulito",
  );

  if (report.statusLines.length) {
    sublist(report.statusLines);
  }

  section("Dipendenze");
  item("node_modules", report.dependencyState.nodeModulesPresent ? "presente" : "mancante");
  item("package-lock.json", report.dependencyState.lockfilePresent ? "presente" : "mancante");

  if (!report.dependencyState.nodeModulesPresent) {
    note("Questo worktree non ha dipendenze installate: prima dei check esegui npm run setup.");
  } else if (report.dependencyState.lockfileNewerThanNodeModules) {
    note("package-lock.json è più recente di node_modules: valuta npm ci prima dei check.");
  }

  section("Diff");
  if (!report.changedFiles.length) {
    note(
      "Nessun file cambiato rispetto alla base. Il comando è utile dopo aver preparato il branch.",
    );
  } else {
    item("File coinvolti", String(report.changedFiles.length));
    sublist(report.changedFiles);
  }

  section("Impatto stimato");
  item("Corsia", report.lane.label);
  if (report.categories.docsOnlyInternal) {
    item("Tipo", "solo documentazione/processo interno");
    note(
      "Di norma non serve release SemVer e non serve attendere Vercel oltre ai check GitHub pertinenti.",
    );
  } else {
    if (report.categories.appOrRuntime) item("App/runtime", "sì");
    if (report.categories.exposedContent) item("Contenuti esposti", "sì");
    if (report.categories.database) item("Supabase/schema", "sì");
    if (report.categories.dependencies) item("Dipendenze", "sì");
    if (report.categories.uiCandidate) item("UI potenzialmente toccata", "sì");
    if (report.categories.releaseAutomation) item("Automazione release/pubblicazione", "sì");
    if (report.categories.toolingOnly) item("Tooling", "sì");
  }

  section("Changelog");
  if (!report.unreleased.body) {
    item("[Non rilasciato]", "vuoto");
    note(
      "Prima di pubblicare modifiche operative aggiungi la voce corretta oppure conferma che il diff e non versionabile.",
    );
  } else {
    item("[Non rilasciato]", report.releaseAdvice.summary);
    if (report.releaseAdvice.warning) note(report.releaseAdvice.warning);
  }

  section("Verifiche consigliate");
  sublist(report.checks);

  section("Sequenza rapida");
  const sequence = [];

  if (!report.dependencyState.nodeModulesPresent) sequence.push("npm run setup");
  if (report.unreleased.body && report.releaseAdvice.bump !== "none")
    sequence.push("npm run release:dry-run");
  sequence.push("npm run publish:prepare -- --run-checks");
  if (report.lane.key === "standard" && report.categories.uiCandidate)
    sequence.push("npm run smoke:a11y:quick");
  if (report.lane.key === "complete" && report.categories.uiCandidate)
    sequence.push("npm run smoke:a11y");
  sequence.push("git push");
  sequence.push("apri PR verso main e controlla Quality + preview Vercel");
  sequence.push("npm run publish:finish -- --pr <numero-pr> --routes /");
  sublist(sequence);
}

function inspectDependencies() {
  const nodeModulesPath = path.join(root, "node_modules");
  const lockfilePath = path.join(root, "package-lock.json");
  const nodeModulesPresent = existsSync(nodeModulesPath);
  const lockfilePresent = existsSync(lockfilePath);
  let lockfileNewerThanNodeModules = false;

  if (nodeModulesPresent && lockfilePresent) {
    lockfileNewerThanNodeModules =
      statSync(lockfilePath).mtimeMs > statSync(nodeModulesPath).mtimeMs;
  }

  return {
    lockfileNewerThanNodeModules,
    lockfilePresent,
    nodeModulesPresent,
  };
}

function readUnreleasedBlock() {
  const changelogPath = path.join(root, "CHANGELOG.md");
  const changelog = readFileSync(changelogPath, "utf8");
  const headerMatch = changelog.match(/^## \[Non rilasciato\]\s*$/m);

  if (!headerMatch || headerMatch.index === undefined) {
    return {
      body: "",
      found: false,
    };
  }

  const afterHeader = changelog.slice(headerMatch.index + headerMatch[0].length);
  const nextHeaderIndex = afterHeader.search(/\n## \[[^\]]+\]/);
  const rawBody = nextHeaderIndex === -1 ? afterHeader : afterHeader.slice(0, nextHeaderIndex);

  return {
    body: rawBody.trim(),
    found: true,
  };
}

function classifyUnreleased(body) {
  if (!body) {
    return {
      bump: null,
      summary: "vuoto",
      warning: "",
    };
  }

  const sections = [...body.matchAll(/^###\s+(.+)$/gm)].map((match) => normalize(match[1]));
  const hasNonVersioned = sections.includes("non versionato");
  const hasMajor = sections.some((section) =>
    ["breaking", "breaking changes", "rimosso"].includes(section),
  );
  const hasMinor = sections.some((section) => ["novita", "aggiunto"].includes(section));
  const hasPatch = sections.some((section) =>
    ["correzioni", "modificato", "risolto", "sicurezza", "sotto il cofano"].includes(section),
  );
  const hasVersioned = hasMajor || hasMinor || hasPatch;

  if (hasNonVersioned && hasVersioned) {
    return {
      bump: "blocked",
      summary: "mescola voci versionate e Non versionato",
      warning: "Separa il lavoro prima di eseguire npm run release.",
    };
  }

  if (hasMajor) return { bump: "major", summary: "richiede release MAJOR", warning: "" };
  if (hasMinor) return { bump: "minor", summary: "richiede release MINOR", warning: "" };
  if (hasPatch) return { bump: "patch", summary: "richiede release PATCH", warning: "" };
  if (hasNonVersioned) return { bump: "none", summary: "nessuna release SemVer", warning: "" };

  return {
    bump: "unknown",
    summary: "sezioni non riconosciute",
    warning: "Controlla i titoli ### nel blocco [Non rilasciato].",
  };
}

function classifyChangedFiles(files, releaseAdvice, packageImpact) {
  const trackedFiles = files.filter((file) => !file.startsWith("(untracked) "));
  const normalizedFiles = files.map((file) => file.replace(/^\(untracked\) /, ""));
  const docsOnlyInternal =
    normalizedFiles.length > 0 && normalizedFiles.every(isInternalDocumentation);
  const dependencies =
    normalizedFiles.includes("package-lock.json") || packageImpact.dependencyFieldsChanged;
  const database = normalizedFiles.some((file) =>
    /^(supabase\/|docs\/data-model\.md$|src\/integrations\/supabase\/types\.ts$)/.test(file),
  );
  const uiCandidate = normalizedFiles.some((file) =>
    /^(src\/(components|routes)\/|src\/styles\.css$|public\/)/.test(file),
  );
  const exposedContent =
    normalizedFiles.some((file) =>
      /^(src\/lib\/version\.ts$|src\/routes\/(index|privacy|terms|novita)|public\/)/.test(file),
    ) ||
    (normalizedFiles.includes("CHANGELOG.md") && releaseAdvice.bump !== "none");
  const processToolingOnly =
    normalizedFiles.length > 0 &&
    releaseAdvice.bump === "none" &&
    normalizedFiles.every((file) =>
      /^(scripts\/|docs\/|AGENTS\.md$|README\.md$|ROADMAP\.md$|CHANGELOG\.md$|package\.json$)/.test(
        file,
      ),
    );
  const toolingOnly =
    normalizedFiles.length > 0 &&
    normalizedFiles.every(
      (file) =>
        /^(scripts\/|\.github\/|docs\/|AGENTS\.md$|README\.md$|ROADMAP\.md$|CHANGELOG\.md$|package\.json$)/.test(
          file,
        ) && !/^src\//.test(file),
    );
  const appOrRuntime =
    normalizedFiles.some((file) =>
      /^(src\/|vite\.config\.ts$|vercel\.json$|package-lock\.json$)/.test(file),
    ) || packageImpact.runtimeFieldsChanged;
  const releaseAutomation = normalizedFiles.some((file) =>
    /^(scripts\/(release|prepush-guard|publish-|smoke-a11y)|\.github\/workflows\/quality\.yml$|package\.json$)/.test(
      file,
    ),
  );
  const docsOrProcessOnly = docsOnlyInternal || processToolingOnly;

  return {
    appOrRuntime,
    database,
    dependencies,
    docsOnlyInternal: docsOrProcessOnly,
    exposedContent,
    releaseAutomation,
    trackedFiles,
    toolingOnly: toolingOnly || processToolingOnly,
    uiCandidate,
  };
}

function inspectPackageImpact(baseRef) {
  const currentPath = path.join(root, "package.json");

  if (!existsSync(currentPath)) {
    return {
      dependencyFieldsChanged: false,
      runtimeFieldsChanged: false,
    };
  }

  const basePackageSource = baseRef ? tryGit(["show", `${baseRef}:package.json`], root) : "";

  if (!basePackageSource) {
    return {
      dependencyFieldsChanged: false,
      runtimeFieldsChanged: false,
    };
  }

  const currentPackage = JSON.parse(readFileSync(currentPath, "utf8"));
  const basePackage = JSON.parse(basePackageSource);
  const dependencyFields = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "overrides",
    "peerDependencies",
  ];
  const runtimeFields = ["bin", "engines", "exports", "imports", "main", "module", "type"];

  return {
    dependencyFieldsChanged: dependencyFields.some(
      (field) => stableJson(basePackage[field]) !== stableJson(currentPackage[field]),
    ),
    runtimeFieldsChanged: runtimeFields.some(
      (field) => stableJson(basePackage[field]) !== stableJson(currentPackage[field]),
    ),
  };
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function classifyPublishLane(categories) {
  if (
    categories.database ||
    categories.dependencies ||
    categories.releaseAutomation ||
    categories.uiCandidate ||
    categories.appOrRuntime
  ) {
    return {
      key: "complete",
      label: "completa",
    };
  }

  if (categories.docsOnlyInternal && !categories.exposedContent) {
    return {
      key: "fast",
      label: "veloce",
    };
  }

  if (categories.exposedContent || categories.toolingOnly) {
    return {
      key: "standard",
      label: "standard",
    };
  }

  return {
    key: "fast",
    label: "veloce",
  };
}

function buildChecks({ categories, changedFiles, lane }) {
  const checks = [];

  if (!changedFiles.length) {
    return ["prepara prima il diff, poi rilancia npm run publish:prepare"];
  }

  if (lane.key === "fast") {
    checks.push("git diff --check");
    if (changedFiles.some(isFormatRelevant)) checks.push("npm run format:changed:check");
    if (changedFiles.includes("CHANGELOG.md")) checks.push("npm run changelog:check");
    return checks;
  }

  checks.push("npm run prepush:guard");

  if (lane.key === "standard" && categories.uiCandidate) {
    checks.push("npm run smoke:a11y:quick per sanity UI mirata");
  }

  if (lane.key === "complete" && categories.uiCandidate) {
    checks.push("npm run smoke:a11y per modifiche UI sostanziali");
  }

  if (categories.database) {
    checks.push(
      "npm run db:push:dry-run e advisors Supabase se cambiano schema, RLS, Storage o auth",
    );
  }

  if (categories.dependencies) {
    checks.push("npm audit --audit-level=moderate");
  }

  if (categories.exposedContent && !categories.appOrRuntime) {
    checks.push("verifica deployment production READY e pagina interessata");
  }

  return checks;
}

function isFormatRelevant(file) {
  const normalized = file.replace(/^\(untracked\) /, "");
  return (
    /\.(cjs|css|html|js|jsx|json|md|mdx|mjs|ts|tsx|yaml|yml)$/.test(normalized) ||
    [".oxfmtrc.json", "components.json"].includes(normalized)
  );
}

function getChangedFiles(baseRef) {
  const groups = [];

  if (baseRef) {
    groups.push(execGit(["diff", "--name-only", `${baseRef}...HEAD`], root));
  }

  groups.push(execGit(["diff", "--cached", "--name-only"], root));
  groups.push(execGit(["diff", "--name-only"], root));
  groups.push(
    lines(execGit(["ls-files", "--others", "--exclude-standard"], root))
      .map((file) => `(untracked) ${file}`)
      .join("\n"),
  );

  return [...new Set(groups.flatMap(lines))].sort();
}

function isInternalDocumentation(file) {
  return (
    /^(AGENTS\.md|README\.md|CONTRIBUTING\.md|SECURITY\.md|ROADMAP\.md)$/.test(file) ||
    /^docs\//.test(file)
  );
}

function resolveDefaultBase() {
  for (const ref of ["origin/main", "main"]) {
    if (tryGit(["rev-parse", "--verify", ref], root)) return ref;
  }

  return "";
}

function resolvePublicationBase({ branch, upstream }) {
  const defaultBase = resolveDefaultBase();
  if (branch === "main" && upstream) return upstream;
  return defaultBase || upstream;
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function section(title) {
  console.log(`\n## ${title}`);
}

function item(label, value) {
  console.log(`- ${label}: ${value}`);
}

function note(value) {
  console.log(`- ${value}`);
}

function sublist(values) {
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

function lines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function run(command, commandArgs) {
  console.log(`\n$ ${[command, ...commandArgs].join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function execGit(gitArgs, cwd) {
  return execFileSync("git", gitArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(gitArgs, cwd) {
  try {
    return execGit(gitArgs, cwd);
  } catch {
    return "";
  }
}

function fail(message) {
  console.error(`Errore publish:prepare: ${message}`);
  process.exit(1);
}
