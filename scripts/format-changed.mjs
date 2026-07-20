#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = execGit(["rev-parse", "--show-toplevel"], { cwd: scriptDir });
const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const check = args.has("--check") || !write;

if (args.has("--help") || args.has("-h")) {
  console.log(`Uso:
  npm run format:changed
  npm run format:changed:check

Opzioni:
  --write   formatta i file cambiati
  --check   verifica i file cambiati senza modificarli`);
  process.exit(0);
}

// oxfmt non ha un flag per ignorare le estensioni sconosciute: filtriamo noi
// alle estensioni che oxfmt sa formattare, così un file .sql/.sh/.png cambiato
// non fa fallire il comando.
const FORMATTABLE = new Set([
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
  "json",
  "jsonc",
  "json5",
  "yaml",
  "yml",
  "toml",
  "css",
  "scss",
  "less",
  "html",
  "md",
  "mdx",
  "graphql",
  "gql",
]);

const files = changedFiles()
  .filter(isExistingFile)
  .filter((file) => FORMATTABLE.has(file.split(".").pop()?.toLowerCase() ?? ""));

if (files.length === 0) {
  console.log("oxfmt Pratix: nessun file cambiato da verificare.");
  process.exit(0);
}

const oxfmtArgs = [...(write ? [] : ["--check"]), ...files];
console.log(`oxfmt Pratix: ${write ? "formatto" : "verifico"} ${files.length} file cambiati.`);

const result = spawnSync("npx", ["oxfmt", ...oxfmtArgs], {
  cwd: root,
  env: process.env,
  shell: false,
  stdio: "inherit",
});

if (result.status !== 0) {
  if (check) {
    console.error(
      "\nFormattazione non allineata. Esegui `npm run format:changed`, poi ricommitta.",
    );
  }

  process.exit(result.status ?? 1);
}

function changedFiles() {
  const base = resolveBase();
  const groups = [];

  if (base) {
    groups.push(execGit(["diff", "--name-only", `${base}...HEAD`], { cwd: root }));
  } else {
    groups.push(
      execGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], { cwd: root }),
    );
  }

  groups.push(execGit(["diff", "--cached", "--name-only"], { cwd: root }));
  groups.push(execGit(["diff", "--name-only"], { cwd: root }));

  return uniqueLines(groups);
}

function resolveBase() {
  if (process.env.PRATIX_FORMAT_BASE) {
    return process.env.PRATIX_FORMAT_BASE;
  }

  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

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

function isExistingFile(file) {
  const absolutePath = join(root, file);

  if (!existsSync(absolutePath)) return false;

  return statSync(absolutePath).isFile();
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
