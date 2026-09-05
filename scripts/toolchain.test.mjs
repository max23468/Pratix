import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
const npmrc = await readFile(new URL("../.npmrc", import.meta.url), "utf8");
const publishPrepare = await readFile(new URL("./publish-prepare.mjs", import.meta.url), "utf8");
const formatChanged = await readFile(new URL("./format-changed.mjs", import.meta.url), "utf8");
const qualityWorkflow = await readFile(
  new URL("../.github/workflows/quality.yml", import.meta.url),
  "utf8",
);
const reactDoctorWorkflow = await readFile(
  new URL("../.github/workflows/react-doctor.yml", import.meta.url),
  "utf8",
);
const governanceWorkflow = await readFile(
  new URL("../.github/workflows/github-governance.yml", import.meta.url),
  "utf8",
);
const doctorConfig = JSON.parse(
  await readFile(new URL("../doctor.config.json", import.meta.url), "utf8"),
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

test("il formatter incrementale lascia il lockfile ai controlli npm", () => {
  assert.match(formatChanged, /OXFMT_IGNORED = new Set\(\["package-lock\.json"\]\)/);
  assert.match(formatChanged, /!OXFMT_IGNORED\.has\(file\)/);
});

test("React Doctor resta bloccante nel workflow dedicato e nel gate generale", () => {
  assert.equal(packageJson.devDependencies["react-doctor"], "0.9.12");
  assert.equal(packageLock.packages[""].devDependencies["react-doctor"], "0.9.12");
  assert.equal(packageJson.scripts.doctor, "react-doctor --scope full --blocking warning .");
  assert.match(packageJson.scripts.check, /npm run doctor/);
  assert.match(qualityWorkflow, /run: npm run check/);
  assert.match(reactDoctorWorkflow, /version: latest/);
  assert.match(reactDoctorWorkflow, /blocking: warning/);
  assert.match(
    reactDoctorWorkflow,
    /scope: \$\{\{ github\.event_name == 'pull_request' && 'changed' \|\| 'full' \}\}/,
  );
  assert.match(reactDoctorWorkflow, /comment: "false"/);
  assert.match(reactDoctorWorkflow, /review-comments: "true"/);
  assert.match(reactDoctorWorkflow, /commit-status: "false"/);
  assert.equal(doctorConfig.blocking, "warning");
  assert.match(governanceWorkflow, /strict_required_status_checks_policy/);
  assert.match(governanceWorkflow, /Build, format and lint,react-doctor/);
});
