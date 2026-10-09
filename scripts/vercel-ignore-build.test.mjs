import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldSkipDependabotPreview } from "./vercel-ignore-build.mjs";

test("skips only Dependabot preview branches", () => {
  assert.equal(
    shouldSkipDependabotPreview({
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "dependabot/npm_and_yarn/vitest-5.0.3",
    }),
    true,
  );
});

test("keeps production real previews and missing metadata building", () => {
  for (const env of [
    { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "dependabot/example" },
    { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "security/coordinated-dependency-patches" },
    { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "fix/dependabot-example" },
    { VERCEL_ENV: "development", VERCEL_GIT_COMMIT_REF: "dependabot/example" },
    { VERCEL_GIT_COMMIT_REF: "dependabot/example" },
    { VERCEL_ENV: "preview" },
    {},
  ]) {
    assert.equal(shouldSkipDependabotPreview(env), false);
  }
});
