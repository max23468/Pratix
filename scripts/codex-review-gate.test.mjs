import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  CODEX_REVIEW_POLLING,
  classifyCodexReview,
  codexAttemptRequestedAt,
  earliestCodexAttemptAt,
  githubRetryAfterMs,
  hasSuccessfulCodexStatus,
  isRetryableGitHubResponse,
  latestCodexInvocation,
  pullRequestNumber,
  retryGitHubRequest,
} from "./codex-review-gate.mjs";

const headSha = "0123456789abcdef0123456789abcdef01234567";
const requestedAt = "2026-08-04T12:00:00Z";
const bot = { login: "chatgpt-codex-connector[bot]" };
const workflow = await readFile(
  new URL("../.github/workflows/codex-review-gate.yml", import.meta.url),
  "utf8",
);
const implementation = await readFile(new URL("./codex-review-gate.mjs", import.meta.url), "utf8");

const classify = (overrides = {}) =>
  classifyCodexReview({
    headSha,
    requestedAt,
    now: new Date(requestedAt).getTime() + 60_000,
    comments: [],
    reactions: [],
    reviewComments: [],
    ...overrides,
  });

test("resta pending senza un esito Codex", () => {
  assert.equal(classify().state, "pending");
});

test("il pollice sulla PR approva la review automatica iniziale", () => {
  assert.equal(
    classify({
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
    }).state,
    "success",
  );
});

test("un pollice tardivo non approva una review del commit precedente", () => {
  assert.equal(
    classify({
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:02Z" }],
      requiresReviewedCommit: true,
      reviews: [
        {
          user: bot,
          submitted_at: "2026-08-04T12:00:01Z",
          body: "**Reviewed commit:** `abcdef0123`",
        },
      ],
    }).state,
    "pending",
  );
});

test("il commit_id nativo approva una review pulita con corpo vuoto", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:02Z",
          body: "",
        },
      ],
    }).state,
    "success",
  );
});

test("un finding nel body della review exact-HEAD prevale", () => {
  assert.equal(
    classify({
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:02Z",
          body: "**P2** Correggi il gate",
        },
      ],
    }).state,
    "failure",
  );
});

test("una review dismissata non approva l'HEAD", () => {
  assert.equal(
    classify({
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          state: "DISMISSED",
          submitted_at: "2026-08-04T12:00:02Z",
          body: "",
        },
      ],
    }).state,
    "pending",
  );
});

test("la review exact-HEAD approva anche senza riusare un vecchio pollice", () => {
  assert.equal(
    classify({
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:01Z" }],
      requiresReviewedCommit: true,
      reviews: [
        {
          user: bot,
          submitted_at: "2026-08-04T12:00:02Z",
          body: `**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
});

test("il pollice senza Reviewed commit non approva", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:01Z" }],
    }).state,
    "pending",
  );
});

test("il pollice sull'invocazione corrente approva l'HEAD senza review testuale", () => {
  const reaction = { user: bot, content: "+1", created_at: "2026-08-04T12:00:01Z" };
  assert.equal(
    classify({
      exactReactions: [reaction],
      reactions: [reaction],
      requiresReviewedCommit: true,
    }).state,
    "success",
  );
});

test("un rerun non riusa il pollice di una vecchia invocazione", () => {
  const reaction = { user: bot, content: "+1", created_at: "2026-08-04T12:00:01Z" };
  assert.equal(
    classify({
      exactReactions: [reaction],
      reactions: [reaction],
      requestedAt: 0,
      requiresReviewedCommit: true,
    }).state,
    "pending",
  );
  assert.equal(
    latestCodexInvocation(
      [
        {
          id: 1,
          user: { login: "max23468" },
          author_association: "OWNER",
          body: "@codex review",
          created_at: "2026-08-04T12:00:01Z",
        },
      ],
      0,
    ),
    undefined,
  );
});

test("il verdetto pulito del task agent approva soltanto l'HEAD dichiarato", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 7)}\``,
        },
      ],
    }).state,
    "success",
  );
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `abcdef0123`",
        },
      ],
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `Nessun problema.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "pending",
  );
});

test("un finding sull'HEAD corrente blocca il gate", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          commit_id: headSha,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P1** Correggi questo caso",
        },
      ],
    }).state,
    "failure",
  );
});

test("un finding del tentativo corrente prevale sul pollice", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          commit_id: headSha,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P1** Correggi questo caso",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:02Z" }],
    }).state,
    "failure",
  );
});

test("un finding pubblicato prima della review resta associato al tentativo corrente", () => {
  const attemptAt = "2026-08-04T12:00:01Z";
  assert.equal(
    classify({
      requestedAt: attemptAt,
      reviewComments: [
        {
          user: bot,
          original_commit_id: headSha,
          created_at: "2026-08-04T12:00:05Z",
          body: "**P1** Finding corrente",
        },
      ],
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:06Z",
          body: "",
        },
      ],
    }).state,
    "failure",
  );
});

test("un finding top-level sull'HEAD prevale sul riepilogo pulito", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `**P2** Correggi il gate.\n\n**Reviewed commit:** \`${headSha.slice(0, 7)}\``,
        },
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "failure",
  );
});

test("un finding top-level senza SHA non viene attribuito al nuovo HEAD", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P2** Correggi il gate.",
        },
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
});

test("un finding top-level marcato su un altro SHA non blocca l'HEAD", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P2** Finding precedente.\n\n**Reviewed commit:** `abcdef0123`",
        },
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
});

test("un rerun ignora i finding top-level senza SHA", () => {
  assert.equal(
    classify({
      requestedAt: 0,
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P2** Finding di un tentativo precedente.",
        },
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
});

test("una review Codex vuota non viene scambiata per un finding", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          commit_id: headSha,
          created_at: "2026-08-04T12:00:01Z",
          body: "Nessuna modifica necessaria.",
        },
      ],
    }).state,
    "pending",
  );
});

test("un finding precedente non segue l'HEAD dopo un rebase", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          commit_id: headSha,
          original_commit_id: "abcdef0123456789abcdef0123456789abcdef01",
          created_at: "2026-08-04T12:00:01Z",
          body: "**P1** Finding già corretto",
        },
      ],
    }).state,
    "pending",
  );
});

test("un finding precedente non chiude un nuovo tentativo sullo stesso HEAD", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          commit_id: headSha,
          original_commit_id: headSha,
          created_at: "2026-08-04T11:59:59Z",
          body: "**P1** Finding precedente",
        },
      ],
      reviews: [
        {
          user: bot,
          submitted_at: "2026-08-04T12:00:02Z",
          body: `**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
    }).state,
    "success",
  );
});

test("un limite Codex chiude il gate senza lasciare il workflow appeso", () => {
  assert.equal(
    classify({
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `You have reached your Codex usage limits for code reviews.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "failure",
  );
});

test("un errore Codex sconosciuto chiude il gate", () => {
  assert.equal(
    classify({
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `Codex Review: Something went wrong. Try again later.\n\nUnknown error\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "failure",
  );
});

test("un errore tardivo non chiude una review corrente ancora in corso", () => {
  assert.equal(
    classify({
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `Codex could not complete the review\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
      progressReactions: [{ user: bot, content: "eyes", created_at: "2026-08-04T12:00:02Z" }],
    }).state,
    "pending",
  );
});

test("un errore successivo a eyes chiude il tentativo", () => {
  assert.equal(
    classify({
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:03Z",
          body: `Codex could not complete the review\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
      progressReactions: [{ user: bot, content: "eyes", created_at: "2026-08-04T12:00:02Z" }],
    }).state,
    "failure",
  );
});

test("un rerun ignora un errore transitorio storico", () => {
  assert.equal(
    classify({
      requestedAt: 0,
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "Codex could not complete the review",
        },
      ],
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:02Z",
          body: "",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
    }).state,
    "success",
  );
});

test("il polling mantiene cinque ore senza saturare la quota con cinque PR", () => {
  assert.equal(CODEX_REVIEW_POLLING.attempts * CODEX_REVIEW_POLLING.intervalMs, 5 * 60 * 60 * 1000);
  assert.ok((5 * 5 * 60 * 60 * 1000) / CODEX_REVIEW_POLLING.intervalMs <= 500);
});

test("legge le reazioni dall'ultima invocazione Codex del tentativo corrente", () => {
  assert.equal(
    latestCodexInvocation(
      [
        { id: 1, user: bot, body: "@codex review", created_at: "2026-08-04T12:00:03Z" },
        {
          id: 2,
          user: { login: "max23468" },
          author_association: "OWNER",
          body: "@codex review",
          created_at: "2026-08-04T12:00:01Z",
        },
        {
          id: 3,
          user: { login: "max23468" },
          author_association: "OWNER",
          body: "@codex review",
          created_at: "2026-08-04T12:00:02Z",
        },
      ],
      requestedAt,
    ).id,
    3,
  );
});

test("ignora un'invocazione creata nello stesso secondo del push", () => {
  assert.equal(
    latestCodexInvocation(
      [
        {
          id: 1,
          user: { login: "max23468" },
          author_association: "OWNER",
          body: "@codex review",
          created_at: requestedAt,
        },
      ],
      requestedAt,
    ),
    undefined,
  );
});

test("l'evento dell'invocazione umana avvia il retry anche nello stesso istante", () => {
  assert.equal(
    latestCodexInvocation(
      [
        {
          id: 7,
          user: { login: "max23468" },
          author_association: "OWNER",
          body: "@codex review",
          created_at: requestedAt,
        },
      ],
      requestedAt,
      7,
    ).id,
    7,
  );
});

test("ignora un'invocazione più recente di un utente esterno", () => {
  assert.equal(
    latestCodexInvocation(
      [
        {
          id: 7,
          user: { login: "max23468" },
          author_association: "OWNER",
          body: "@codex review",
          created_at: "2026-08-04T12:00:01Z",
        },
        {
          id: 8,
          user: { login: "external-user" },
          author_association: "NONE",
          body: "@codex review",
          created_at: "2026-08-04T12:00:02Z",
        },
      ],
      requestedAt,
    ).id,
    7,
  );
});

test("un commento bot tardivo conserva il boundary del tentativo attivo", () => {
  assert.equal(
    codexAttemptRequestedAt(
      { comment: { user: bot, created_at: "2026-08-04T12:00:09Z" } },
      false,
      requestedAt,
    ),
    requestedAt,
  );
  assert.equal(
    codexAttemptRequestedAt(
      {
        comment: {
          user: { login: "max23468" },
          created_at: "2026-08-04T12:00:09Z",
        },
      },
      false,
      requestedAt,
    ),
    "2026-08-04T12:00:09Z",
  );
});

test("il bootstrap accetta soltanto un numero PR", () => {
  assert.equal(pullRequestNumber({ pull_request: { number: 42 } }), "42");
  assert.equal(pullRequestNumber({ issue: { number: 43, pull_request: {} } }), "43");
  assert.equal(pullRequestNumber({}, "208"), "208");
  assert.throws(() => pullRequestNumber({ issue: { number: 43 } }), /Numero PR non valido/);
  assert.throws(() => pullRequestNumber({}, "208/merge"), /Numero PR non valido/);
});

test("ritenta soltanto errori GitHub recuperabili", () => {
  assert.equal(isRetryableGitHubResponse(429, null), true);
  assert.equal(isRetryableGitHubResponse(502, null), true);
  assert.equal(isRetryableGitHubResponse(403, "0"), true);
  assert.equal(isRetryableGitHubResponse(403, "4999", "60"), true);
  assert.equal(
    isRetryableGitHubResponse(403, "4999", null, "You have exceeded a secondary rate limit"),
    true,
  );
  assert.equal(isRetryableGitHubResponse(403, "4999"), false);
  assert.equal(isRetryableGitHubResponse(404, null), false);
});

test("ritenta anche le scritture GitHub transitorie", async () => {
  let attempts = 0;
  const waits = [];
  const result = await retryGitHubRequest(
    async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("transitorio"), { retryable: true });
      return "ok";
    },
    async (ms) => waits.push(ms),
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [1000, 1000]);
});

test("attende il reset della quota GitHub primaria", () => {
  assert.equal(githubRetryAfterMs("60", null, "4999", 1_000), 60_000);
  assert.equal(githubRetryAfterMs(null, "100", "0", 90_000), 10_000);
  assert.equal(githubRetryAfterMs(null, "100", "4999", 90_000), 60_000);
});

test("un rerun riusa soltanto l'ultimo status Codex riuscito dello stesso SHA", () => {
  assert.equal(
    hasSuccessfulCodexStatus([
      { context: "codex-review", state: "success" },
      { context: "codex-review", state: "pending" },
    ]),
    true,
  );
  assert.equal(
    hasSuccessfulCodexStatus([
      { context: "codex-review", state: "failure" },
      { context: "codex-review", state: "success" },
    ]),
    false,
  );
});

test("mantiene il primo pending dello SHA come inizio del tentativo automatico", () => {
  assert.equal(
    earliestCodexAttemptAt(
      [
        { context: "codex-review", state: "pending", created_at: "2026-08-04T12:00:04Z" },
        { context: "codex-review", state: "pending", created_at: "2026-08-04T12:00:01Z" },
      ],
      "fallback",
    ),
    "2026-08-04T12:00:01Z",
  );
});

test("l'import in GitHub Actions non avvia la CLI", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import(${JSON.stringify(import.meta.resolve("./codex-review-gate.mjs"))})`,
    ],
    {
      env: { ...process.env, GITHUB_ACTIONS: "true", GITHUB_EVENT_PATH: "/non-esiste" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("il workflow usa eventi, permessi e codice trusted", () => {
  assert.match(workflow, /pull_request_target:/);
  assert.match(
    workflow,
    /types:\s*\[opened, synchronize, reopened, ready_for_review, closed, converted_to_draft\]/,
  );
  assert.doesNotMatch(workflow, /pull_request_review:/);
  assert.doesNotMatch(workflow, /pull_request_review_comment:/);
  assert.match(workflow, /issue_comment:\s*\n\s*types:\s*\[created\]/);
  assert.match(workflow, /chatgpt-codex-connector\[bot\]/);
  assert.match(workflow, /github\.event\.issue\.pull_request/);
  assert.match(workflow, /OWNER.*MEMBER.*COLLABORATOR/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /type:\s*number/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /issues:\s*read/);
  assert.match(workflow, /pull-requests:\s*read/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.ok(workflow.indexOf("if: >-") < workflow.indexOf("concurrency:"));
  assert.match(workflow, /contains\(github\.event\.comment\.body, '@codex review'\)/);
  assert.match(
    workflow,
    /github\.event\.action != 'closed' && github\.event\.action != 'converted_to_draft'/,
  );
  assert.equal(
    [
      ...workflow.matchAll(
        /github\.event\.action != 'closed' && github\.event\.action != 'converted_to_draft'/g,
      ),
    ].length,
    3,
  );
  assert.match(workflow, /timeout-minutes:\s*310/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /ref:\s*\$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.doesNotMatch(workflow, /github\.event\.pull_request\.head/);
  assert.doesNotMatch(implementation, /event\.action === "deleted"/);
});
