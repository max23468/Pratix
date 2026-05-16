#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import axe from "axe-core";
import { webkit } from "playwright";
import { loadEnv } from "vite";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/recupera-password", "/privacy", "/termini"];
const AUTH_ROUTES = [
  "/dashboard",
  "/committenti",
  "/prezzi",
  "/clienti",
  "/controparti",
  "/pratiche",
  "/attivita",
  "/fatture",
  "/novita",
  "/account",
  "/impostazioni",
  "/creazione-guidata",
];
const THEMES = ["light", "dark"];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
];
const DEFAULT_SMOKE_EMAIL = "codex.pratix.test.20260509@gmail.com";

const args = new Set(process.argv.slice(2));
const startServer = args.has("--start-server");
const publicOnly = args.has("--public-only");
const port = Number(process.env.PRATIX_SMOKE_PORT || 3300);
const localEnv = loadEnv(
  process.env.MODE || process.env.NODE_ENV || "development",
  process.cwd(),
  "",
);
const envValue = (name) => process.env[name] || localEnv[name] || "";
const baseUrl =
  envValue("PRATIX_SMOKE_BASE_URL") ||
  (startServer ? `http://127.0.0.1:${port}` : "http://127.0.0.1:3000");
const email = envValue("PRATIX_SMOKE_EMAIL") || DEFAULT_SMOKE_EMAIL;
const supabaseUrl = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
const supabaseServiceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");

let server;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Server not ready yet.
    }
    await wait(500);
  }
  throw new Error(`Dev server non raggiungibile su ${url}`);
}

async function startDevServer() {
  server = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: process.cwd(),
      env: { ...process.env, VITE_TURNSTILE_SITE_KEY: "" },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => process.stderr.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  server.on("exit", (code) => {
    if (code && code !== 0) process.stderr.write(`Dev server terminato con codice ${code}\n`);
  });
  await waitForServer(baseUrl);
}

async function newContext(browser, theme, viewport) {
  const context = await browser.newContext({
    colorScheme: theme,
    viewport: { width: viewport.width, height: viewport.height },
  });
  await context.addInitScript((selectedTheme) => {
    window.localStorage.setItem("pratix.theme", selectedTheme);
    document.documentElement.classList.toggle("dark", selectedTheme === "dark");
    document.documentElement.style.colorScheme = selectedTheme;
  }, theme);
  return context;
}

async function login(page) {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profileError) {
    throw new Error(`Profilo smoke non verificabile: ${profileError.message}`);
  }
  if (!profile) {
    throw new Error("Smoke autenticato richiede un account test esistente in profiles.");
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/dashboard` },
  });
  if (error) throw new Error(`Magic link smoke non generato: ${error.message}`);
  const actionLink = data.properties?.action_link;
  if (!actionLink) throw new Error("Magic link smoke non ricevuto da Supabase.");

  await page.goto(actionLink, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await page.waitForLoadState("networkidle", { timeout: 7_000 }).catch(() => undefined);
}

async function ensureDocumentReady(page, route) {
  const hasBody = await page
    .waitForFunction(() => Boolean(document.documentElement && document.body), undefined, {
      timeout: 5_000,
    })
    .then(() => true)
    .catch(() => false);
  if (hasBody) return;

  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(() => Boolean(document.documentElement && document.body), undefined, {
      timeout: 5_000,
    })
    .catch(() => {
      throw new Error(`DOM non pronto per lo smoke della route ${route}`);
    });
}

function isTransientPageError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Execution context was destroyed") ||
    message.includes("Importing a module script failed") ||
    message.includes("Couldn't load preload assets")
  );
}

async function auditPage(page, route, theme, viewport, authenticated, issues) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await auditPageOnce(page, route, theme, viewport, authenticated, issues);
      return;
    } catch (error) {
      if (attempt === 0 && isTransientPageError(error)) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 7_000 }).catch(() => undefined);
        await ensureDocumentReady(page, route);
        continue;
      }
      throw error;
    }
  }
}

async function auditPageOnce(page, route, theme, viewport, authenticated, issues) {
  const currentPath = new URL(page.url(), baseUrl).pathname;
  if (currentPath !== route) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  }
  await page.waitForLoadState("networkidle", { timeout: 7_000 }).catch(() => undefined);
  await ensureDocumentReady(page, route);
  await page.addScriptTag({ content: axe.source });

  const result = await page.evaluate(async () => {
    return window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
  });

  for (const violation of result.violations) {
    for (const node of violation.nodes) {
      issues.push({
        type: "axe",
        route,
        theme,
        viewport: viewport.name,
        authenticated,
        id: violation.id,
        impact: violation.impact,
        target: node.target.join(" "),
      });
    }
  }

  const layoutIssues = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const pageOverflow = Math.max(root.scrollWidth, body.scrollWidth) > root.clientWidth + 1;
    const clippedControls = Array.from(
      document.querySelectorAll("button, a, [role='button'], [role='combobox']"),
    )
      .filter((element) => element instanceof HTMLElement)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const styles = getComputedStyle(element);
        if (styles.overflowX === "visible") return false;
        if (element.className.toString().includes("truncate")) return false;
        return element.scrollWidth > element.clientWidth + 2;
      })
      .slice(0, 5)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (
          element.innerText ||
          element.getAttribute("aria-label") ||
          element.getAttribute("placeholder") ||
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 80),
      }));
    return { pageOverflow, clippedControls };
  });

  if (layoutIssues.pageOverflow) {
    issues.push({
      type: "layout",
      route,
      theme,
      viewport: viewport.name,
      authenticated,
      id: "horizontal-overflow",
    });
  }
  for (const clipped of layoutIssues.clippedControls) {
    issues.push({
      type: "layout",
      route,
      theme,
      viewport: viewport.name,
      authenticated,
      id: "clipped-control",
      target: `${clipped.tag} ${clipped.text}`,
    });
  }
}

async function run() {
  if (startServer) await startDevServer();
  const browser = await webkit.launch({ headless: true });
  const issues = [];
  let audited = 0;

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await newContext(browser, theme, viewport);
      const page = await context.newPage();
      for (const route of PUBLIC_ROUTES) {
        await auditPage(page, route, theme, viewport, false, issues);
        audited += 1;
      }
      await context.close();
    }
  }

  const canAuditAuth = Boolean(!publicOnly && email && supabaseUrl && supabaseServiceRoleKey);
  if (canAuditAuth) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const context = await newContext(browser, theme, viewport);
        const page = await context.newPage();
        await login(page);
        for (const route of AUTH_ROUTES) {
          await auditPage(page, route, theme, viewport, true, issues);
          audited += 1;
        }
        await context.close();
      }
    }
  }

  await browser.close();
  console.log(
    JSON.stringify(
      {
        baseUrl,
        audited,
        authenticated: canAuditAuth,
        authMode: canAuditAuth ? "magiclink-admin" : "none",
        viewports: VIEWPORTS.map((viewport) => viewport.name),
        themes: THEMES,
        issueCount: issues.length,
        issues: issues.slice(0, 40),
      },
      null,
      2,
    ),
  );
  if (issues.length) process.exitCode = 1;
}

function stopDevServer() {
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    stopDevServer();
  });
