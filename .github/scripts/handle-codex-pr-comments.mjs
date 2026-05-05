#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const statePath = process.env.CODEX_PR_SCAN_STATE_PATH ?? ".github/codex-pr-scan-state.json";
const pendingCommentsPath =
  process.env.CODEX_PENDING_COMMENTS_PATH ?? ".github/codex-pr-pending-comments.md";
const codexLoginPattern = new RegExp(process.env.CODEX_BOT_LOGIN_PATTERN ?? "codex", "i");
const dryRun = process.env.DRY_RUN === "true";
const marker = "<!-- pratix-codex-pr-comment-handler -->";
const codexCommand = process.env.CODEX_AUTOFIX_COMMENT ?? "@codex address that feedback";

if (!repository) {
  fail("GITHUB_REPOSITORY non impostato.");
}

if (!token) {
  fail("GITHUB_TOKEN non impostato.");
}

const [owner, repo] = repository.split("/");

if (!owner || !repo) {
  fail(`GITHUB_REPOSITORY non valido: ${repository}`);
}

const state = readState();
const prs = await listPullRequests();
const processedPrs = [];
const pendingEntries = [];
let maxPrNumber = state.lastPrNumber;

for (const pr of prs) {
  maxPrNumber = Math.max(maxPrNumber, pr.number);

  const checksSinceSkip = state.prChecks?.[pr.number]?.checksSinceSkip ?? 0;
  const skippedCycle = checksSinceSkip >= 2;

  const threads = await listReviewThreads(pr.number);
  const codexThreads = threads.filter(isCodexThread);
  pendingEntries.push({
    number: pr.number,
    skippedCycle,
    threads: codexThreads,
    title: pr.title,
    url: pr.html_url,
  });

  if (codexThreads.length === 0) {
    upsertPrCheckState(pr.number, { checksSinceSkip: skippedCycle ? 0 : checksSinceSkip + 1 });
    processedPrs.push({
      action: skippedCycle ? "skipped-cycle" : "none",
      codexThreads: 0,
      number: pr.number,
      url: pr.html_url,
    });
    continue;
  }

  const canRequestHandling = pr.state === "open" && !skippedCycle;
  const alreadyRequested = canRequestHandling ? await hasAutomationRequest(pr.number) : false;

  if (canRequestHandling && !alreadyRequested) {
    await requestCodexHandling(pr, codexThreads);
  }

  processedPrs.push({
    action: canRequestHandling
      ? alreadyRequested
        ? "already-requested"
        : dryRun
          ? "dry-run"
          : "requested-codex"
      : "tracked-only",
    codexThreads: codexThreads.length,
    number: pr.number,
    url: pr.html_url,
  });
  upsertPrCheckState(pr.number, { checksSinceSkip: skippedCycle ? 0 : checksSinceSkip + 1 });
}

writeState({
  lastPrNumber: maxPrNumber,
  lastRunAt: new Date().toISOString(),
  prChecks: state.prChecks ?? {},
  processedPrs,
});

writePendingCommentsReport(pendingEntries);

console.log(
  JSON.stringify(
    {
      dryRun,
      lastPrNumberBefore: state.lastPrNumber,
      lastPrNumberAfter: maxPrNumber,
      processedPrs,
    },
    null,
    2,
  ),
);

function readState() {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return {
      lastPrNumber: 0,
      lastRunAt: null,
      processedPrs: [],
    };
  }
}

function writeState(nextState) {
  if (dryRun) return;

  writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
}

function upsertPrCheckState(prNumber, value) {
  if (!state.prChecks) state.prChecks = {};
  state.prChecks[prNumber] = value;
}

function writePendingCommentsReport(entries) {
  const actionableEntries = entries.filter((entry) => entry.threads.length > 0);
  const skippedEntries = entries.filter((entry) => entry.skippedCycle);

  const header = [
    "# Codex pending comments",
    "",
    "Questo file viene aggiornato automaticamente dal workflow `Codex PR comments`.",
    "Contiene tutti i thread con commenti del bot Codex (sia risolti sia non risolti), su tutte le PR.",
    "",
  ];

  if (actionableEntries.length === 0 && skippedEntries.length === 0) {
    header.push(
      "## Nessun commento pending",
      "",
      "Al momento non risultano thread da risolvere.",
      "",
    );
  } else {
    header.push(`## PR con commenti pending (${actionableEntries.length})`, "");

    for (const entry of actionableEntries) {
      header.push(`### PR #${entry.number} — ${entry.title}`);
      header.push(`- URL: ${entry.url}`);
      header.push(`- Thread pending: ${entry.threads.length}`);
      header.push("");

      for (const thread of entry.threads) {
        const firstCodexComment = thread.comments.nodes.find((comment) =>
          codexLoginPattern.test(comment.author?.login ?? ""),
        );
        const location = thread.line ? `${thread.path}:${thread.line}` : thread.path;
        const summary = firstLine(firstCodexComment?.body ?? "commento Codex") ?? "commento Codex";
        const threadUrl = firstCodexComment?.url ?? entry.url;
        const threadState = `resolved=${thread.isResolved ? "yes" : "no"}, outdated=${
          thread.isOutdated ? "yes" : "no"
        }`;
        header.push(`- [ ] \`${location}\` — ${summary} (${threadState}) ([thread](${threadUrl}))`);
      }

      header.push("");
    }

    if (skippedEntries.length > 0) {
      header.push(`## PR saltate nel ciclo (${skippedEntries.length})`, "");
      for (const entry of skippedEntries) {
        header.push(`- PR #${entry.number} — ${entry.title} (${entry.url})`);
      }
      header.push("");
    }
  }

  const output = `${header.join("\n").trimEnd()}\n`;
  if (dryRun) {
    console.log(`DRY RUN: file pending commenti non aggiornato (${pendingCommentsPath}).`);
    return;
  }
  writeFileSync(pendingCommentsPath, output);
}

async function listPullRequests() {
  const results = [];

  for (let page = 1; page <= 30; page++) {
    const batch = await githubJson(
      `/repos/${owner}/${repo}/pulls?state=all&sort=created&direction=desc&per_page=100&page=${page}`,
    );

    if (batch.length === 0) break;

    results.push(...batch);
  }

  return results;
}

async function listReviewThreads(prNumber) {
  const query = `query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 50) {
              nodes {
                author {
                  login
                }
                body
                createdAt
                url
              }
            }
          }
        }
      }
    }
  }`;

  const threads = [];
  let cursor = null;

  do {
    const data = await githubGraphql(query, {
      cursor,
      number: prNumber,
      owner,
      repo,
    });
    const page = data.repository.pullRequest.reviewThreads;

    threads.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  return threads;
}

function isCodexThread(thread) {
  if (thread.isResolved || thread.isOutdated) return false;

  return thread.comments.nodes.some((comment) => {
    const login = comment.author?.login ?? "";

    return codexLoginPattern.test(login);
  });
}

async function hasAutomationRequest(prNumber) {
  const comments = await githubJson(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`,
  );

  return comments.some((comment) => comment.body.includes(marker));
}

async function requestCodexHandling(pr, threads) {
  const threadList = threads
    .map((thread) => {
      const firstCodexComment = thread.comments.nodes.find((comment) =>
        codexLoginPattern.test(comment.author?.login ?? ""),
      );
      const location = thread.line ? `${thread.path}:${thread.line}` : thread.path;

      return `- ${location}: ${firstLine(firstCodexComment?.body ?? "commento Codex") ?? "commento Codex"}`;
    })
    .join("\n");

  const body = `${marker}
${codexCommand}

Ho trovato ${threads.length} thread Codex non risolti in questa PR:
${threadList}

Per favore applica le correzioni richieste, esegui le verifiche pertinenti e aggiorna la PR.`;

  if (dryRun) {
    console.log(`DRY RUN: commento non pubblicato su PR #${pr.number}:\n${body}`);
    return;
  }

  await githubJson(`/repos/${owner}/${repo}/issues/${pr.number}/comments`, {
    body,
  });
}

function firstLine(value) {
  return value
    .split("\n")
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .find(Boolean)
    ?.slice(0, 160);
}

async function githubJson(path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: body ? "POST" : "GET",
  });

  if (!response.ok) {
    const text = await response.text();
    fail(`GitHub REST ${path} ha risposto ${response.status}: ${text}`);
  }

  return response.json();
}

async function githubGraphql(query, variables) {
  const response = await fetch("https://api.github.com/graphql", {
    body: JSON.stringify({
      query,
      variables,
    }),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = await response.json();

  if (!response.ok || payload.errors) {
    fail(`GitHub GraphQL ha risposto con errore: ${JSON.stringify(payload.errors ?? payload)}`);
  }

  return payload.data;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
