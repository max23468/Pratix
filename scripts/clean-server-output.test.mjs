import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { cleanServerOutput } from "./clean-server-output.mjs";

const exists = (target) =>
  access(target).then(
    () => true,
    () => false,
  );

test("pulisce solo gli output server generati", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pratix-clean-output-"));
  t.after(() => rm(root, { force: true, recursive: true }));

  await mkdir(path.join(root, ".output", "server"), { recursive: true });
  await mkdir(path.join(root, ".vercel", "output", "functions"), { recursive: true });
  await writeFile(path.join(root, ".output", "server", "stale.mjs"), "");
  await writeFile(path.join(root, ".vercel", "output", "functions", "stale.mjs"), "");
  await writeFile(path.join(root, ".vercel", "project.json"), "{}\n");

  cleanServerOutput(root);

  assert.equal(await exists(path.join(root, ".output")), false);
  assert.equal(await exists(path.join(root, ".vercel", "output")), false);
  assert.equal(await exists(path.join(root, ".vercel", "project.json")), true);
});
