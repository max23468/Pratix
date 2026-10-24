#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const SKIP_PREVIEW_BRANCH_PREFIXES = ["dependabot/", "instinct/"];

export function shouldSkipDependabotPreview(env = process.env) {
  return (
    env.VERCEL_ENV === "preview" &&
    typeof env.VERCEL_GIT_COMMIT_REF === "string" &&
    SKIP_PREVIEW_BRANCH_PREFIXES.some((prefix) =>
      env.VERCEL_GIT_COMMIT_REF.startsWith(prefix),
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const skip = shouldSkipDependabotPreview();
  console.log(skip ? `Vercel preview skipped: bot branch (${SKIP_PREVIEW_BRANCH_PREFIXES.join(" | ")}).` : "Vercel build proceeds.");
  process.exit(skip ? 0 : 1);
}
