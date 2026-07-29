#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

const DEFAULT_SMOKE_EMAIL = "codex.pratix.test.20260509@gmail.com";
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

async function createSmokeActionLink(serviceRoleKey, supabaseUrl) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = envValue("PRATIX_SMOKE_EMAIL") || DEFAULT_SMOKE_EMAIL;
  const baseUrl =
    envValue("PRATIX_SMOKE_BASE_URL") ||
    `http://127.0.0.1:${Number(envValue("PRATIX_SMOKE_PORT") || 3300)}`;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profileError) throw new Error(`Profilo smoke non verificabile: ${profileError.message}`);
  if (!profile)
    throw new Error("Smoke autenticato richiede un account test esistente in profiles.");

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/dashboard` },
  });
  if (error) throw new Error(`Magic link smoke non generato: ${error.message}`);
  if (!data.properties?.action_link) {
    throw new Error("Magic link smoke non ricevuto da Supabase.");
  }
  return data.properties.action_link;
}

function readServiceRoleKey(projectRef) {
  const result = spawnSync(
    "npx",
    ["supabase", "projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
    {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
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

async function runSmoke(actionLink, supabaseUrl) {
  const child = spawn(
    process.execPath,
    ["scripts/smoke-a11y.mjs", "--start-server", "--auth-required"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PRATIX_SMOKE_ACTION_LINK: actionLink,
        SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: "",
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
  const supabaseUrl = resolveSupabaseUrl(projectRef);
  const serviceRoleKey = readServiceRoleKey(projectRef);
  const actionLink = await createSmokeActionLink(serviceRoleKey, supabaseUrl);
  await runSmoke(actionLink, supabaseUrl);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
