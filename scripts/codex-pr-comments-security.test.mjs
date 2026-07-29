import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const script = await readFile(
  new URL("../.github/scripts/handle-codex-pr-comments.mjs", import.meta.url),
  "utf8",
);
const workflow = await readFile(
  new URL("../.github/workflows/codex-pr-comments.yml", import.meta.url),
  "utf8",
);

test("la inbox accetta solo il bot Codex esatto e commenti di collaboratori", () => {
  assert.match(script, /"chatgpt-codex-connector\[bot\]"/);
  assert.doesNotMatch(script, /new RegExp|CODEX_BOT_LOGIN_PATTERN/);
  assert.match(workflow, /"OWNER","MEMBER","COLLABORATOR"/);
  assert.match(workflow, /github\.event\.comment\.author_association/);
});
