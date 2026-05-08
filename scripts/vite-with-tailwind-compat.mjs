#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import process from "node:process";

const compatImport = "--import=./scripts/tailwind-register-hooks-compat.mjs";
const currentNodeOptions = process.env.NODE_OPTIONS?.trim() ?? "";
const nextNodeOptions = currentNodeOptions.includes(compatImport)
  ? currentNodeOptions
  : [currentNodeOptions, compatImport].filter(Boolean).join(" ");

const require = createRequire(import.meta.url);
const vitePackageJsonPath = require.resolve("vite/package.json");
const vitePackageJson = JSON.parse(readFileSync(vitePackageJsonPath, "utf8"));
const viteBinRelativePath =
  typeof vitePackageJson.bin === "string" ? vitePackageJson.bin : vitePackageJson.bin?.vite;

if (typeof viteBinRelativePath !== "string") {
  console.error("Errore: bin Vite non trovato in node_modules/vite/package.json.");
  process.exit(1);
}

const viteBin = path.resolve(path.dirname(vitePackageJsonPath), viteBinRelativePath);
const child = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    NODE_OPTIONS: nextNodeOptions,
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
