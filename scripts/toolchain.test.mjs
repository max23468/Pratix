import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
const npmrc = await readFile(new URL("../.npmrc", import.meta.url), "utf8");
const publishPrepare = await readFile(new URL("./publish-prepare.mjs", import.meta.url), "utf8");
const qualityWorkflow = await readFile(
  new URL("../.github/workflows/quality.yml", import.meta.url),
  "utf8",
);
const toolchain = await readFile(new URL("../docs/TOOLCHAIN.md", import.meta.url), "utf8");
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url)));

test("npm 12 viene installato prima delle dipendenze", () => {
  const bootstrap = "npx --yes npm@12.0.2";

  assert.equal(packageJson.packageManager, "npm@12.0.2");
  assert.deepEqual(packageJson.engines, { node: ">=24.15 <25", npm: ">=12 <13" });
  assert.deepEqual(packageLock.packages[""].engines, packageJson.engines);
  assert.equal(npmrc.trim(), "engine-strict=true");
  assert.equal(packageJson.scripts.setup, `${bootstrap} ci`);
  assert.ok(
    qualityWorkflow.indexOf("npm install --global npm@12.0.2") < qualityWorkflow.indexOf("npm ci"),
  );
  assert.doesNotMatch(publishPrepare, /valuta npm ci/);
  assert.doesNotMatch(toolchain, /^npm ci$/m);
  assert.equal(vercel.installCommand, `${bootstrap} install`);
});
