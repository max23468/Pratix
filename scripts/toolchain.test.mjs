import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
const npmrc = await readFile(new URL("../.npmrc", import.meta.url), "utf8");
const qualityWorkflow = await readFile(
  new URL("../.github/workflows/quality.yml", import.meta.url),
  "utf8",
);
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url)));

test("npm 12 viene installato prima delle dipendenze", () => {
  const bootstrap = "npm install --global npm@12.0.1";

  assert.equal(packageJson.packageManager, "npm@12.0.1");
  assert.deepEqual(packageJson.engines, { node: ">=24.15 <25", npm: ">=12 <13" });
  assert.deepEqual(packageLock.packages[""].engines, packageJson.engines);
  assert.equal(npmrc.trim(), "engine-strict=true");
  assert.equal(packageJson.scripts.setup, `${bootstrap} && hash -r && npm ci`);
  assert.ok(qualityWorkflow.indexOf(bootstrap) < qualityWorkflow.indexOf("npm ci"));
  assert.equal(vercel.installCommand, "npx --yes npm@12.0.1 install");
});
