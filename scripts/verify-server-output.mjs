#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const outputDirectories = [
  path.resolve(process.cwd(), ".output/server"),
  path.resolve(process.cwd(), ".vercel/output/functions"),
].filter(existsSync);

if (outputDirectories.length === 0) {
  console.error("Output server non trovato nei layout Nitro locale o Vercel.");
  process.exit(1);
}

const modules = outputDirectories
  .flatMap((outputDirectory) =>
    readdirSync(outputDirectory, { recursive: true })
      .filter((entry) => typeof entry === "string" && entry.endsWith(".mjs"))
      .map((entry) => path.join(outputDirectory, entry)),
  )
  .sort();

const localEntrypoint = path.resolve(process.cwd(), ".output/server/index.mjs");
const entrypoints = modules.filter(
  (modulePath) =>
    modulePath === localEntrypoint ||
    (modulePath.includes(`${path.sep}.vercel${path.sep}output${path.sep}functions${path.sep}`) &&
      modulePath.includes(".func") &&
      modulePath.endsWith(`${path.sep}index.mjs`)),
);

if (modules.length === 0) {
  console.error("Nessun modulo ESM trovato negli output server.");
  process.exit(1);
}

if (entrypoints.length === 0) {
  console.error("Nessun entrypoint SSR trovato negli output server.");
  process.exit(1);
}

for (const modulePath of modules) {
  const result = spawnSync(process.execPath, ["--check", modulePath], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error(`Modulo server non valido: ${path.relative(process.cwd(), modulePath)}`);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

const importEntrypoint = [
  'import { pathToFileURL } from "node:url";',
  "await import(pathToFileURL(process.argv[1]).href);",
  "process.exit(0);",
].join(" ");

for (const entrypoint of entrypoints) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", importEntrypoint, entrypoint],
    {
      encoding: "utf8",
      env: { ...process.env, PORT: "0" },
      timeout: 30_000,
    },
  );

  if (result.status !== 0) {
    console.error(`Entrypoint SSR non importabile: ${path.relative(process.cwd(), entrypoint)}`);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(
  `Output server ESM valido: ${modules.length} moduli e ${entrypoints.length} entrypoint controllati.`,
);
