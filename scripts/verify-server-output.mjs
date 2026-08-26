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

if (modules.length === 0) {
  console.error("Nessun modulo ESM trovato negli output server.");
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

console.log(`Output server ESM valido: ${modules.length} moduli controllati.`);
