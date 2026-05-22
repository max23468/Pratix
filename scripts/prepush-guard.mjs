#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";

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

const plan = buildPlan(fingerprint);
console.log(`Pre-push Pratix: ${plan.summary}`);

await runPlan(plan);

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

function buildPlan(fingerprint) {
  const files = fingerprint.changedFiles;
  const checks = [{ key: "diff-check", command: "git", args: ["diff", "--check"], phase: "fast" }];
  const hasPackageChanges = files.some((file) =>
    ["package.json", "package-lock.json"].includes(file),
  );
  const packageImpact = inspectPackageImpact(fingerprint.source.comparisonRef);
  const hasChangelogChanges = files.includes("CHANGELOG.md");
  const hasFormatRelevantChanges = files.some(isFormatRelevant);
  const hasBuildRelevantChanges = files.some(
    (file) =>
      ["vite.config.ts", "vitest.coverage-global.config.ts", "vercel.json"].includes(file) ||
      /^(src|supabase)\//.test(file) ||
      packageImpact.dependencyFieldsChanged ||
      packageImpact.runtimeFieldsChanged,
  );
  const hasTestRelevantChanges = files.some(
    (file) =>
      ["vitest.config.ts", "vitest.coverage-global.config.ts"].includes(file) ||
      /^(src|tests)\//.test(file) ||
      /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file) ||
      packageImpact.dependencyFieldsChanged ||
      packageImpact.runtimeFieldsChanged,
  );
  const hasLintRelevantChanges = files.some(
    (file) =>
      /^(src|scripts|\.github\/scripts)\/.*\.(cjs|js|jsx|mjs|ts|tsx)$/.test(file) ||
      [
        "eslint.config.js",
        "vite.config.ts",
        "vitest.config.ts",
        "vitest.coverage-global.config.ts",
      ].includes(file),
  );

  if (hasFormatRelevantChanges) {
    checks.push({
      key: "format-changed",
      command: "npm",
      args: ["run", "format:changed:check"],
      phase: "fast",
    });
  }

  if (hasChangelogChanges) {
    checks.push({
      key: "changelog-check",
      command: "npm",
      args: ["run", "changelog:check"],
      phase: "fast",
    });
  }

  if (hasBuildRelevantChanges) {
    checks.push({ key: "build", command: "npm", args: ["run", "build"], phase: "build" });
  }

  if (hasTestRelevantChanges) {
    checks.push({ key: "test", command: "npm", args: ["test"], phase: "quality" });
  }

  if (hasLintRelevantChanges) {
    checks.push({ key: "lint", command: "npm", args: ["run", "lint"], phase: "quality" });
  }

  if (hasPackageChanges) {
    checks.push({
      key: "audit",
      command: "npm",
      args: ["audit", "--audit-level=moderate"],
      phase: "quality",
    });
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
  const committedDiff = comparisonRef
    ? execGit(["diff", "--binary", `${comparisonRef}...HEAD`], { cwd: root })
    : "";
  const stagedDiff = execGit(["diff", "--cached", "--binary"], { cwd: root });
  const unstagedDiff = execGit(["diff", "--binary"], { cwd: root });
  const committedChanges = comparisonRef
    ? execGit(["diff", "--name-only", `${comparisonRef}...HEAD`], { cwd: root })
    : execGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], { cwd: root });
  const stagedChanges = execGit(["diff", "--cached", "--name-only"], { cwd: root });
  const unstagedChanges = execGit(["diff", "--name-only"], { cwd: root });
  const status = execGit(["status", "--porcelain", "--untracked-files=no"], { cwd: root });
  const npmVersion = execToolVersion("npm", ["--version"]);

  const changedFiles = uniqueLines([committedChanges, stagedChanges, unstagedChanges]);
  const source = {
    changedFiles,
    committedDiffHash: hashString(committedDiff),
    comparisonRef,
    head,
    node: process.version,
    npm: npmVersion,
    stagedDiffHash: hashString(stagedDiff),
    status,
    unstagedDiffHash: hashString(unstagedDiff),
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

async function runPlan(plan) {
  const phaseOrder = ["fast", "build", "quality"];
  const sequential = process.env.PRATIX_CHECKS_SEQUENTIAL === "1";

  for (const phase of phaseOrder) {
    const checks = plan.checks.filter((check) => check.phase === phase);
    if (!checks.length) continue;

    const mode = sequential || checks.length === 1 ? "sequenziale" : "parallelo";
    console.log(`\n# Fase ${phase}: ${checks.length} check in modo ${mode}`);

    const results = [];
    if (sequential || checks.length === 1) {
      for (const check of checks) {
        results.push(await runCheck(check));
        if (results.at(-1).status !== 0) break;
      }
    } else {
      results.push(...(await Promise.all(checks.map(runCheck))));
    }

    for (const result of results) {
      printCheckResult(result);
    }

    const failed = results.find((result) => result.status !== 0);
    if (failed) process.exit(failed.status ?? 1);
  }
}

function runCheck(check) {
  console.log(`$ ${[check.command, ...check.args].join(" ")}`);

  return new Promise((resolve) => {
    const child = spawn(check.command, check.args, {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ check, output: error.message, status: 1 });
    });
    child.on("close", (status) => {
      resolve({ check, output, status: status ?? 1 });
    });
  });
}

function printCheckResult(result) {
  const command = [result.check.command, ...result.check.args].join(" ");
  const status = result.status === 0 ? "ok" : `fallito (${result.status})`;
  console.log(`\n## ${command} — ${status}`);
  const output = result.output.trim();
  if (output) console.log(output);
}

function execGit(gitArgs, options) {
  return execFileSync("git", gitArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function execToolVersion(command, commandArgs) {
  try {
    return execFileSync(command, commandArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function uniqueLines(groups) {
  return [...new Set(groups.flatMap((group) => group.split("\n").filter(Boolean)))].sort();
}

function hashString(value) {
  return createHash("sha256").update(value).digest("hex");
}

function inspectPackageImpact(comparisonRef) {
  if (!existsSync(`${root}/package.json`) || !comparisonRef) {
    return {
      dependencyFieldsChanged: false,
      runtimeFieldsChanged: false,
    };
  }

  let basePackage;
  try {
    basePackage = JSON.parse(execGit(["show", `${comparisonRef}:package.json`], { cwd: root }));
  } catch {
    return {
      dependencyFieldsChanged: false,
      runtimeFieldsChanged: false,
    };
  }

  const currentPackage = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
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
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}
