#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export function shouldSkipDependabotPreview(env = process.env) {
  return (
    env.VERCEL_ENV === "preview" &&
    typeof env.VERCEL_GIT_COMMIT_REF === "string" &&
    env.VERCEL_GIT_COMMIT_REF.startsWith("dependabot/")
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const skip = shouldSkipDependabotPreview();
  console.log(skip ? "Vercel preview skipped: Dependabot branch." : "Vercel build proceeds.");
  process.exit(skip ? 0 : 1);
}
