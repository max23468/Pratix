#!/usr/bin/env node

import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function cleanServerOutput(root = process.cwd()) {
  for (const outputDirectory of [".output", path.join(".vercel", "output")]) {
    rmSync(path.resolve(root, outputDirectory), { force: true, recursive: true });
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) cleanServerOutput();
