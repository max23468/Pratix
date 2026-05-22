#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = execGit(["rev-parse", "--show-toplevel"], process.cwd());
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  showHelp();
  process.exit(0);
}

const pr = args.pr ? readPullRequest(args.pr) : null;
const branchToClean = args.branch || pr?.headRefName || "";
const mergeSha = args.sha || pr?.mergeCommit?.oid || "";

if (pr && pr.state !== "MERGED") {
  fail(`PR #${args.pr} non mergeata: stato ${pr.state}.`);
}

section("Aggiornamento main");
ensureCleanWorktree();
run("git", ["fetch", "--prune"]);
checkoutMainIfNeeded();
run("git", ["pull", "--ff-only"]);

if (mergeSha) {
  ensureMergedSha(mergeSha);
}

section("Verifica produzione");
const vercelResult = await verifyVercelProduction({ expectedSha: mergeSha });
for (const line of vercelResult.messages) item(line.label, line.value);

const probeResults = await probeProductionRoutes(args.routes, args.productionUrl);
for (const result of probeResults) {
  item(result.route, `${result.status} ${result.url}`);
}

section("Pulizia branch e worktree");
cleanupLocalBranch(branchToClean);
cleanupBranchWorktrees(branchToClean);

section("Esito");
item("main", execGit(["rev-parse", "--short", "HEAD"], root));
if (pr) item("PR", `#${args.pr} ${pr.url}`);
if (branchToClean) item("Branch dedicato", branchToClean);
item("Produzione", args.productionUrl);

function parseArgs(argv) {
  const parsed = {
    branch: "",
    help: false,
    pr: "",
    productionUrl: "https://pratix.vercel.app",
    routes: ["/"],
    sha: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`Valore mancante per ${arg}.`);
      index += 1;
      return value;
    };

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--pr") {
      parsed.pr = nextValue();
      continue;
    }
    if (arg.startsWith("--pr=")) {
      parsed.pr = arg.slice("--pr=".length);
      continue;
    }
    if (arg === "--branch") {
      parsed.branch = nextValue();
      continue;
    }
    if (arg.startsWith("--branch=")) {
      parsed.branch = arg.slice("--branch=".length);
      continue;
    }
    if (arg === "--sha") {
      parsed.sha = nextValue();
      continue;
    }
    if (arg.startsWith("--sha=")) {
      parsed.sha = arg.slice("--sha=".length);
      continue;
    }
    if (arg === "--routes") {
      parsed.routes = parseRoutes(nextValue());
      continue;
    }
    if (arg.startsWith("--routes=")) {
      parsed.routes = parseRoutes(arg.slice("--routes=".length));
      continue;
    }
    if (arg === "--production-url") {
      parsed.productionUrl = trimTrailingSlash(nextValue());
      continue;
    }
    if (arg.startsWith("--production-url=")) {
      parsed.productionUrl = trimTrailingSlash(arg.slice("--production-url=".length));
      continue;
    }

    fail(`Argomento non riconosciuto: ${arg}`);
  }

  return parsed;
}

function showHelp() {
  console.log(`Uso:
  npm run publish:finish -- --pr 142 --routes /,/novita
  npm run publish:finish -- --branch codex/mia-branch --sha <merge-sha>

Cosa fa:
  - richiede worktree pulito;
  - verifica che la PR indicata sia mergeata;
  - aggiorna main con fetch/prune e pull --ff-only;
  - verifica il deployment production Vercel via API quando VERCEL_TOKEN è presente;
  - esegue probe HTTP sulle route indicate;
  - elimina il branch locale dedicato solo con git branch -d;
  - rimuove worktree dedicati solo se puliti.`);
}

function readPullRequest(number) {
  const output = execFileSync(
    "gh",
    [
      "pr",
      "view",
      number,
      "--repo",
      "max23468/Pratix",
      "--json",
      "headRefName,mergeCommit,state,url",
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return JSON.parse(output);
}

function ensureCleanWorktree() {
  const status = execGit(["status", "--short"], root);
  if (status) {
    fail(
      "Worktree non pulito. Completa, committa o sposta le modifiche prima di chiudere la pubblicazione.",
    );
  }
}

function checkoutMainIfNeeded() {
  const branch = execGit(["branch", "--show-current"], root);
  if (branch === "main") return;
  run("git", ["checkout", "main"]);
}

function ensureMergedSha(sha) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    fail(`Il merge commit ${sha.slice(0, 12)} non è antenato di main locale.`);
  }
  item("Merge commit", sha.slice(0, 12));
}

async function verifyVercelProduction({ expectedSha }) {
  const token = process.env.VERCEL_TOKEN || "";
  const project = readVercelProject();

  if (!token) {
    return {
      messages: [
        {
          label: "Vercel API",
          value: "saltata: VERCEL_TOKEN non configurato, uso probe HTTP mirati",
        },
      ],
    };
  }

  if (!project?.projectId) {
    return {
      messages: [
        {
          label: "Vercel API",
          value: "saltata: .vercel/project.json non trovato o incompleto",
        },
      ],
    };
  }

  const params = new URLSearchParams({
    limit: "5",
    projectId: project.projectId,
    target: "production",
  });
  if (project.orgId) params.set("teamId", project.orgId);

  const response = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    fail(`Vercel API non disponibile: HTTP ${response.status}.`);
  }

  const data = await response.json();
  const deployments = Array.isArray(data.deployments) ? data.deployments : [];
  const ready = deployments.find((deployment) => deployment.state === "READY");
  if (!ready) fail("Nessun deployment production READY trovato su Vercel.");

  const deploymentSha =
    ready.meta?.githubCommitSha || ready.gitSource?.sha || ready.meta?.githubCommit || "";
  const deploymentRef = ready.meta?.githubCommitRef || ready.gitSource?.ref || "";

  if (expectedSha && deploymentSha && !expectedSha.startsWith(deploymentSha)) {
    fail(
      `Deployment Vercel READY ma SHA diverso: atteso ${expectedSha.slice(0, 12)}, ricevuto ${deploymentSha.slice(0, 12)}.`,
    );
  }

  return {
    messages: [
      { label: "Vercel deployment", value: ready.uid || ready.id || "READY" },
      { label: "Stato", value: ready.state },
      { label: "URL", value: ready.url || "(non indicato)" },
      {
        label: "Commit",
        value: deploymentSha ? deploymentSha.slice(0, 12) : "non esposto dall'API",
      },
      { label: "Ref", value: deploymentRef || "non esposta dall'API" },
    ],
  };
}

function readVercelProject() {
  const projectPath = path.join(root, ".vercel/project.json");
  if (!existsSync(projectPath)) return null;

  try {
    return JSON.parse(readFileSync(projectPath, "utf8"));
  } catch {
    return null;
  }
}

async function probeProductionRoutes(routes, productionUrl) {
  const results = [];
  for (const route of routes) {
    const url = `${productionUrl}${route}`;
    let response = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" });
    if (!response.ok && [405, 501].includes(response.status)) {
      response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
    }
    if (!response.ok) fail(`Probe produzione fallito su ${url}: HTTP ${response.status}.`);
    results.push({ route, status: `HTTP ${response.status}`, url: response.url });
  }
  return results;
}

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function cleanupLocalBranch(branchName) {
  if (!branchName) {
    item("Branch locale", "nessun branch dedicato indicato");
    return;
  }

  const currentBranch = execGit(["branch", "--show-current"], root);
  if (currentBranch === branchName) {
    item("Branch locale", `non eliminato: sei ancora su ${branchName}`);
    return;
  }

  const branches = execGit(["branch", "--format=%(refname:short)"], root).split("\n");
  if (!branches.includes(branchName)) {
    item("Branch locale", `${branchName} già assente`);
    return;
  }

  const result = spawnSync("git", ["branch", "-d", branchName], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0) {
    item("Branch locale", `${branchName} eliminato`);
    return;
  }

  item(
    "Branch locale",
    `non eliminato automaticamente: ${result.stderr.trim() || result.stdout.trim()}`,
  );
}

function cleanupBranchWorktrees(branchName) {
  if (!branchName) {
    item("Worktree", "nessun branch dedicato indicato");
    return;
  }

  const worktrees = parseWorktrees(execGit(["worktree", "list", "--porcelain"], root));
  let touched = false;
  for (const worktree of worktrees) {
    if (worktree.path === root || worktree.branch !== `refs/heads/${branchName}`) continue;
    touched = true;
    const status = execGit(["-C", worktree.path, "status", "--short"], root);
    if (status) {
      item("Worktree", `${worktree.path} non rimosso: contiene modifiche`);
      continue;
    }

    const result = spawnSync("git", ["worktree", "remove", worktree.path], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status === 0) {
      item("Worktree", `${worktree.path} rimosso`);
    } else {
      item("Worktree", `${worktree.path} non rimosso: ${result.stderr.trim()}`);
    }
  }

  if (!touched) item("Worktree", "nessun worktree dedicato da rimuovere");
}

function parseWorktrees(output) {
  const entries = [];
  let current = null;
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { branch: "", path: line.slice("worktree ".length) };
      continue;
    }
    if (current && line.startsWith("branch ")) current.branch = line.slice("branch ".length);
  }
  if (current) entries.push(current);
  return entries;
}

function parseRoutes(value) {
  return value
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith("/") ? route : `/${route}`));
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function section(title) {
  console.log(`\n## ${title}`);
}

function item(label, value) {
  console.log(`- ${label}: ${value}`);
}

function run(command, commandArgs) {
  console.log(`$ ${[command, ...commandArgs].join(" ")}`);
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

function fail(message) {
  console.error(`Errore publish:finish: ${message}`);
  process.exit(1);
}
