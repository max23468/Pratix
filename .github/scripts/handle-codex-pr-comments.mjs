#!/usr/bin/env node

import process from "node:process";

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const codexLoginPattern = new RegExp(process.env.CODEX_BOT_LOGIN_PATTERN ?? "codex", "i");
const inboxIssueTitle = process.env.CODEX_INBOX_ISSUE_TITLE ?? "Codex feedback inbox";
const codexCommand = process.env.CODEX_AUTOFIX_COMMENT ?? "@codex address that feedback";
const inboxMarker = "<!-- pratix-codex-feedback-inbox -->";
const requestMarker = "<!-- pratix-codex-feedback-request -->";
const dryRun = process.env.DRY_RUN === "true";

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

const prs = await listPullRequests();
const inboxEntries = [];
const requestedPrs = [];

for (const pr of prs) {
  const threads = await listReviewThreads(pr.number);
  const codexThreads = threads.filter(isCodexThread);

  if (codexThreads.length === 0) continue;

  const actionableThreads = codexThreads.filter(isActionableThread);
  const historicalThreads = codexThreads.filter((thread) => !isActionableThread(thread));

  inboxEntries.push({
    actionableThreads,
    historicalThreads,
    number: pr.number,
    state: pr.state,
    title: pr.title,
    url: pr.html_url,
    wasMerged: Boolean(pr.merged_at),
  });

  if (actionableThreads.length === 0) continue;

  const alreadyRequested = await hasAutomationRequest(pr.number, actionableThreads);

  if (!alreadyRequested) {
    const posted = await requestCodexHandling(pr, actionableThreads);
    if (posted) requestedPrs.push(pr.number);
  }
}

const inboxIssue = await upsertInboxIssue(inboxEntries);

console.log(
  JSON.stringify(
    {
      dryRun,
      inboxIssue: inboxIssue?.html_url ?? null,
      prsScanned: prs.length,
      prsWithCodexThreads: inboxEntries.length,
      requestedPrs,
      totalActionableThreads: inboxEntries.reduce(
        (total, entry) => total + entry.actionableThreads.length,
        0,
      ),
      totalHistoricalThreads: inboxEntries.reduce(
        (total, entry) => total + entry.historicalThreads.length,
        0,
      ),
    },
    null,
    2,
  ),
);

async function listPullRequests() {
  const results = [];

  for (let page = 1; ; page++) {
    const query = new URLSearchParams({
      direction: "desc",
      page: String(page),
      per_page: "100",
      sort: "updated",
      state: "all",
    });
    const batch = await githubJson(`/repos/${owner}/${repo}/pulls?${query}`);

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
            originalLine
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
  return thread.comments.nodes.some((comment) =>
    codexLoginPattern.test(comment.author?.login ?? ""),
  );
}

function isActionableThread(thread) {
  return isCodexThread(thread) && !thread.isResolved && !thread.isOutdated;
}

async function hasAutomationRequest(prNumber, threads) {
  const comments = await githubJson(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`,
  );
  const threadUrls = threads.map(getCodexThreadUrl).filter(Boolean);

  return comments.some((comment) => {
    if (!comment.body?.includes(requestMarker)) return false;
    if (threadUrls.length === 0) return true;

    return threadUrls.every((url) => comment.body.includes(url));
  });
}

async function requestCodexHandling(pr, threads) {
  const threadList = threads.map(renderThreadForRequest).join("\n");
  const prState = pr.state === "open" ? "aperta" : pr.merged_at ? "mergiata" : "chiusa";
  const body = `${requestMarker}
${codexCommand}

Ho trovato ${threads.length} thread Codex actionable in questa PR (${prState}):
${threadList}

Risolvi i problemi segnalati, controlla anche la issue "${inboxIssueTitle}" per il backlog completo dei commenti Codex e aggiorna la PR o apri un follow-up se questa PR non è più modificabile.`;

  if (dryRun) {
    console.log(`DRY RUN: commento non pubblicato su PR #${pr.number}:\n${body}`);
    return true;
  }

  try {
    await githubJson(`/repos/${owner}/${repo}/issues/${pr.number}/comments`, {
      body,
    });
    return true;
  } catch (error) {
    console.warn(`Impossibile commentare la PR #${pr.number}: ${error.message}`);
    return false;
  }
}

async function upsertInboxIssue(entries) {
  const body = buildInboxBody(entries);
  const existingIssue = await findInboxIssue();

  if (dryRun) {
    console.log(`DRY RUN: issue inbox non aggiornata.\n${body}`);
    return existingIssue;
  }

  if (existingIssue) {
    return githubJson(
      `/repos/${owner}/${repo}/issues/${existingIssue.number}`,
      {
        body,
        state: "open",
        title: inboxIssueTitle,
      },
      "PATCH",
    );
  }

  return githubJson(`/repos/${owner}/${repo}/issues`, {
    body,
    title: inboxIssueTitle,
  });
}

async function findInboxIssue() {
  const query = new URLSearchParams({
    q: `repo:${owner}/${repo} is:issue in:title "${inboxIssueTitle}"`,
  });
  const result = await githubJson(`/search/issues?${query}`);

  return result.items.find((issue) => issue.title === inboxIssueTitle) ?? null;
}

function buildInboxBody(entries) {
  const actionableEntries = entries
    .map((entry) => ({
      ...entry,
      threads: entry.actionableThreads,
    }))
    .filter((entry) => entry.threads.length > 0);
  const historicalEntries = entries
    .map((entry) => ({
      ...entry,
      threads: entry.historicalThreads,
    }))
    .filter((entry) => entry.threads.length > 0);
  const totalActionable = actionableEntries.reduce(
    (total, entry) => total + entry.threads.length,
    0,
  );
  const totalHistorical = historicalEntries.reduce(
    (total, entry) => total + entry.threads.length,
    0,
  );

  const lines = [
    inboxMarker,
    "# Codex feedback inbox",
    "",
    "Issue aggiornata automaticamente dal workflow `Codex PR comments`.",
    "Fonte di verità: review thread GitHub su tutte le PR, aperte, chiuse e mergiate.",
    "",
    "## Da risolvere ora",
    "",
  ];

  if (totalActionable === 0) {
    lines.push("Nessun thread Codex actionable al momento.", "");
  } else {
    lines.push(`Thread actionable: ${totalActionable}`, "");
    appendEntrySection(lines, actionableEntries, true);
  }

  lines.push("## Storico e audit", "");

  if (totalHistorical === 0) {
    lines.push("Nessun thread Codex storico da mostrare.", "");
  } else {
    lines.push(`Thread storici: ${totalHistorical}`, "");
    appendEntrySection(lines, historicalEntries, false);
  }

  lines.push(
    "## Regola operativa",
    "",
    "Quando questa issue segnala thread actionable, Codex deve risolvere prima i commenti nuovi e poi controllare anche lo storico ancora rilevante. La inbox si aggiorna su nuove review, commenti PR, sincronizzazioni/chiusure PR e commenti issue; se un thread viene solo marcato come risolto nella UI GitHub senza push o commenti, lascia un commento sulla inbox o avvia il workflow manuale per forzare il refresh. I thread pending non pubblicati da GitHub non sono leggibili via API finché la review non viene inviata.",
    "",
  );

  return `${lines.join("\n").trimEnd()}\n`;
}

function appendEntrySection(lines, entries, actionable) {
  for (const entry of entries) {
    lines.push(`### PR #${entry.number} - ${entry.title}`);
    lines.push(`- URL: ${entry.url}`);
    lines.push(`- Stato: ${renderPrState(entry)}`);
    lines.push(`- Thread: ${entry.threads.length}`);
    lines.push("");

    for (const thread of entry.threads) {
      const checkbox = actionable ? "[ ]" : "[x]";
      lines.push(`- ${checkbox} ${renderThread(thread)}`);
    }

    lines.push("");
  }
}

function renderPrState(entry) {
  if (entry.state === "open") return "aperta";
  return entry.wasMerged ? "mergiata" : "chiusa";
}

function renderThread(thread) {
  const firstCodexComment = getFirstCodexComment(thread);
  const location = renderThreadLocation(thread);
  const summary = firstLine(firstCodexComment?.body ?? "commento Codex") ?? "commento Codex";
  const threadUrl = firstCodexComment?.url;
  const state = `resolved=${thread.isResolved ? "yes" : "no"}, outdated=${
    thread.isOutdated ? "yes" : "no"
  }`;
  const link = threadUrl ? ` ([thread](${threadUrl}))` : "";

  return `\`${location}\` - ${summary} (${state})${link}`;
}

function renderThreadForRequest(thread) {
  const firstCodexComment = getFirstCodexComment(thread);
  const summary = firstLine(firstCodexComment?.body ?? "commento Codex") ?? "commento Codex";
  const threadUrl = firstCodexComment?.url;
  const link = threadUrl ? ` - ${threadUrl}` : "";

  return `- ${renderThreadLocation(thread)}: ${summary}${link}`;
}

function renderThreadLocation(thread) {
  const line = thread.line ?? thread.originalLine;

  return line ? `${thread.path}:${line}` : thread.path;
}

function getCodexThreadUrl(thread) {
  return getFirstCodexComment(thread)?.url;
}

function getFirstCodexComment(thread) {
  return thread.comments.nodes.find((comment) =>
    codexLoginPattern.test(comment.author?.login ?? ""),
  );
}

function firstLine(value) {
  return value
    .split("\n")
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .find(Boolean)
    ?.slice(0, 160);
}

async function githubJson(path, body, method) {
  const response = await fetch(`https://api.github.com${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: method ?? (body ? "POST" : "GET"),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub REST ${path} ha risposto ${response.status}: ${text}`);
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
