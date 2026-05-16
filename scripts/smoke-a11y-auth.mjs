#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { loadEnv } from "vite";

const localEnv = loadEnv(
  process.env.MODE || process.env.NODE_ENV || "development",
  process.cwd(),
  "",
);
const envValue = (name) => process.env[name] || localEnv[name] || "";

function resolveProjectRef() {
  const configuredRef = envValue("VITE_SUPABASE_PROJECT_ID");
  if (configuredRef) return configuredRef;

  const supabaseUrl = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
  if (!supabaseUrl) return "";

  try {
    return new URL(supabaseUrl).hostname.split(".")[0];
  } catch {
    return "";
  }
}

function resolveSupabaseUrl(projectRef) {
  return (
    envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL") || `https://${projectRef}.supabase.co`
  );
}

function readServiceRoleKey(projectRef) {
  const result = spawnSync(
    "npx",
    ["supabase", "projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  if (result.status !== 0) {
    const detail = result.stderr.split("\n").filter(Boolean).slice(0, 3).join("\n");
    throw new Error(
      `Service role Supabase non recuperabile via CLI.${detail ? `\n${detail}` : ""}`,
    );
  }

  let keys;
  try {
    keys = JSON.parse(result.stdout);
  } catch {
    throw new Error("Risposta Supabase CLI non leggibile: impossibile estrarre la service role.");
  }

  const serviceRole = keys.find((key) => key.name === "service_role");
  if (!serviceRole?.api_key) {
    throw new Error("Service role Supabase non trovata per il progetto configurato.");
  }
  return serviceRole.api_key;
}

async function runSmoke(serviceRoleKey, supabaseUrl) {
  const child = spawn(
    process.execPath,
    ["scripts/smoke-a11y.mjs", "--start-server", "--auth-required"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      },
      stdio: "inherit",
    },
  );

  const code = await new Promise((resolve) => child.on("close", resolve));
  if (code) process.exitCode = code;
}

const projectRef = resolveProjectRef();
if (!projectRef) {
  console.error("Smoke autenticato non avviato: manca VITE_SUPABASE_PROJECT_ID o SUPABASE_URL.");
  process.exit(1);
}

try {
  await runSmoke(readServiceRoleKey(projectRef), resolveSupabaseUrl(projectRef));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
