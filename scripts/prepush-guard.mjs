#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = execGit(["rev-parse", "--show-toplevel"], { cwd: scriptDir });
const cachePath = execGit(["rev-parse", "--git-path", "pratix-prepush-cache.json"], {
  cwd: root,
});
const args = new Set(process.argv.slice(2));

if (process.env.PRATIX_SKIP_PREPUSH === "1") {
  console.log(
    "Pre-push Pratix saltato per PRATIX_SKIP_PREPUSH=1. Usalo solo se i check equivalenti sono gia stati eseguiti sullo stesso diff.",
  );
  process.exit(0);
}

const fingerprint = buildFingerprint();
const cached = readCache();

if (!args.has("--force") && cached?.fingerprint === fingerprint.id) {
  console.log(
    `Pre-push Pratix gia validato per questa fingerprint (${fingerprint.id.slice(0, 12)}).`,
  );
  process.exit(0);
}

const plan = buildPlan(fingerprint.changedFiles);
console.log(`Pre-push Pratix: ${plan.summary}`);

for (const check of plan.checks) {
  run(check.command, check.args);
}

writeFileSync(
  cachePath,
  `${JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      fingerprint: fingerprint.id,
      head: fingerprint.source.head,
      plan: plan.summary,
    },
    null,
    2,
  )}\n`,
);

function buildPlan(files) {
  const checks = [{ command: "git", args: ["diff", "--check"] }];
  const hasPackageChanges = files.some((file) =>
    ["package.json", "package-lock.json"].includes(file),
  );
  const hasFormatRelevantChanges = files.some(isFormatRelevant);
  const hasBuildRelevantChanges = files.some(
    (file) =>
      [
        "CHANGELOG.md",
        "package.json",
        "package-lock.json",
        "vite.config.ts",
        "vercel.json",
      ].includes(file) || /^(src|supabase)\//.test(file),
  );
  const hasLintRelevantChanges = files.some(
    (file) =>
      /^(src|scripts|\.github\/scripts)\/.*\.(cjs|js|jsx|mjs|ts|tsx)$/.test(file) ||
      ["eslint.config.js", "vite.config.ts"].includes(file),
  );

  if (hasFormatRelevantChanges) {
    checks.push({ command: "npm", args: ["run", "format:changed:check"] });
  }

  if (hasBuildRelevantChanges) {
    checks.push({ command: "npm", args: ["run", "build"] });
  }

  if (hasLintRelevantChanges) {
    checks.push({ command: "npm", args: ["run", "lint"] });
  }

  if (hasPackageChanges) {
    checks.push({ command: "npm", args: ["audit", "--audit-level=moderate"] });
  }

  return {
    checks,
    summary: checks.map((check) => [check.command, ...check.args].join(" ")).join(" && "),
  };
}

function isFormatRelevant(file) {
  return (
    /\.(cjs|css|html|js|jsx|json|md|mdx|mjs|ts|tsx|yaml|yml)$/.test(file) ||
    [".prettierrc", ".prettierignore", "components.json"].includes(file)
  );
}

function buildFingerprint() {
  const head = execGit(["rev-parse", "HEAD"], { cwd: root });
  const comparisonRef = resolveComparisonRef();
  const committedChanges = comparisonRef
    ? execGit(["diff", "--name-only", `${comparisonRef}...HEAD`], { cwd: root })
    : execGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], { cwd: root });
  const stagedChanges = execGit(["diff", "--cached", "--name-only"], { cwd: root });
  const unstagedChanges = execGit(["diff", "--name-only"], { cwd: root });
  const status = execGit(["status", "--porcelain", "--untracked-files=no"], { cwd: root });

  const changedFiles = uniqueLines([committedChanges, stagedChanges, unstagedChanges]);
  const source = {
    changedFiles,
    comparisonRef,
    head,
    node: process.version,
    status,
  };
  const id = createHash("sha256").update(JSON.stringify(source)).digest("hex");

  return { changedFiles, id, source };
}

function resolveComparisonRef() {
  try {
    return execGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], {
      cwd: root,
    });
  } catch {
    return resolveDefaultBase();
  }
}

function resolveDefaultBase() {
  for (const ref of ["origin/main", "main"]) {
    try {
      execGit(["rev-parse", "--verify", ref], { cwd: root });
      return ref;
    } catch {
      // Try the next default base.
    }
  }

  return "";
}

function readCache() {
  if (!existsSync(cachePath)) return null;

  try {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
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

function execGit(gitArgs, options) {
  return execFileSync("git", gitArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function uniqueLines(groups) {
  return [...new Set(groups.flatMap((group) => group.split("\n").filter(Boolean)))].sort();
}
