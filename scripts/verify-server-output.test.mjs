import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const verifier = fileURLToPath(new URL("./verify-server-output.mjs", import.meta.url));

async function fixture(t, relativeEntrypoint, entrypointSource, chunkSource = "") {
  const root = await mkdtemp(path.join(os.tmpdir(), "pratix-server-output-"));
  t.after(() => rm(root, { force: true, recursive: true }));

  const entrypoint = path.join(root, relativeEntrypoint);
  await mkdir(path.dirname(entrypoint), { recursive: true });
  await writeFile(entrypoint, entrypointSource);
  if (chunkSource) await writeFile(path.join(path.dirname(entrypoint), "chunk.mjs"), chunkSource);
  return root;
}

function verify(root) {
  return spawnSync(process.execPath, [verifier], {
    cwd: root,
    encoding: "utf8",
  });
}

test("accetta un entrypoint Vercel collegabile", async (t) => {
  const root = await fixture(
    t,
    ".vercel/output/functions/__server.func/index.mjs",
    'export { value } from "./chunk.mjs";\n',
    "export const value = 1;\n",
  );

  const result = verify(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 moduli e 1 entrypoint controllati/);
});

test("rifiuta un re-export assente che node --check non rileva", async (t) => {
  const root = await fixture(
    t,
    ".output/server/index.mjs",
    'export { missing } from "./chunk.mjs";\n',
    "export const value = 1;\n",
  );

  const syntaxOnly = spawnSync(process.execPath, ["--check", ".output/server/index.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  const result = verify(root);

  assert.equal(syntaxOnly.status, 0, syntaxOnly.stderr);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Entrypoint SSR non importabile/);
  assert.match(result.stderr, /does not provide an export named 'missing'/);
});
