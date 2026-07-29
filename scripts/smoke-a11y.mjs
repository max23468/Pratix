#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";
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
  "/controllo-duplicati",
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
const DEFAULT_AUDIT_TIMEOUT_MS = 20_000;

const options = parseArgs(process.argv.slice(2));
const startServer = options.startServer;
const publicOnly = options.publicOnly;
const authRequired = options.authRequired;
const port = Number(process.env.PRATIX_SMOKE_PORT || 3300);
const auditTimeoutMs = parsePositiveIntegerEnv(
  "PRATIX_SMOKE_AUDIT_TIMEOUT_MS",
  DEFAULT_AUDIT_TIMEOUT_MS,
);
const localEnv = loadEnv(
  process.env.MODE || process.env.NODE_ENV || "development",
  process.cwd(),
  "",
);
const envValue = (name) => process.env[name] || localEnv[name] || "";
const baseUrl =
  envValue("PRATIX_SMOKE_BASE_URL") ||
  (startServer ? `http://127.0.0.1:${port}` : "http://127.0.0.1:3000");
const supabaseUrl = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
const smokeActionLink = envValue("PRATIX_SMOKE_ACTION_LINK");
const selectedThemes = options.themes ?? (options.quick ? ["light"] : THEMES);
const selectedViewports =
  options.viewports ??
  (options.quick
    ? VIEWPORTS.filter((viewport) => ["desktop", "mobile"].includes(viewport.name))
    : VIEWPORTS);
const selectedRoutes = selectRoutes(options);

let server;

function parseArgs(argv) {
  const parsed = {
    authRequired: false,
    help: false,
    publicOnly: false,
    quick: false,
    routes: null,
    startServer: false,
    themes: null,
    viewports: null,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--start-server") {
      parsed.startServer = true;
      continue;
    }
    if (arg === "--public-only") {
      parsed.publicOnly = true;
      continue;
    }
    if (arg === "--auth-required") {
      parsed.authRequired = true;
      continue;
    }
    if (arg === "--quick") {
      parsed.quick = true;
      continue;
    }
    if (arg.startsWith("--routes=")) {
      parsed.routes = parseCsv(arg.slice("--routes=".length));
      continue;
    }
    if (arg.startsWith("--themes=")) {
      parsed.themes = parseCsv(arg.slice("--themes=".length));
      continue;
    }
    if (arg.startsWith("--viewports=")) {
      parsed.viewports = parseViewportList(parseCsv(arg.slice("--viewports=".length)));
      continue;
    }

    throw new Error(`Argomento smoke non riconosciuto: ${arg}`);
  }

  if (parsed.help) {
    console.log(`Uso:
  npm run smoke:a11y
  npm run smoke:a11y:quick
  node scripts/smoke-a11y.mjs --start-server --routes=/,/novita --themes=light --viewports=desktop,mobile

Opzioni:
  --quick          Smoke leggero: route /, tema light, viewport desktop+mobile.
  --routes=a,b    Limita le route. Le route non pubbliche richiedono auth Supabase.
  --themes=a,b    Limita i temi: light,dark.
  --viewports=a,b Limita viewport: desktop,tablet,mobile.
  --public-only   Salta route autenticate.
  --auth-required Fallisce se una route autenticata non è verificabile.`);
    process.exit(0);
  }

  validateSubset("themes", parsed.themes, THEMES);
  return parsed;
}

function parseCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseViewportList(names) {
  validateSubset(
    "viewports",
    names,
    VIEWPORTS.map((viewport) => viewport.name),
  );
  return VIEWPORTS.filter((viewport) => names.includes(viewport.name));
}

function validateSubset(label, values, allowed) {
  if (!values) return;
  const invalid = values.filter((value) => !allowed.includes(value));
  if (invalid.length) {
    throw new Error(
      `${label} non validi: ${invalid.join(", ")}. Valori ammessi: ${allowed.join(", ")}.`,
    );
  }
}

function selectRoutes(parsed) {
  const requestedRoutes = parsed.routes ?? (parsed.quick ? ["/"] : null);
  if (!requestedRoutes) {
    return {
      auth: AUTH_ROUTES,
      authExplicit: false,
      public: PUBLIC_ROUTES,
    };
  }

  const normalizedRoutes = [...new Set(requestedRoutes.map(normalizeRoute))];
  const unknownRoutes = normalizedRoutes.filter(
    (route) => !PUBLIC_ROUTES.includes(route) && !AUTH_ROUTES.includes(route),
  );
  if (unknownRoutes.length) {
    throw new Error(`Route smoke non riconosciute: ${unknownRoutes.join(", ")}`);
  }

  return {
    auth: normalizedRoutes.filter((route) => AUTH_ROUTES.includes(route)),
    authExplicit: normalizedRoutes.some((route) => AUTH_ROUTES.includes(route)),
    public: normalizedRoutes.filter((route) => PUBLIC_ROUTES.includes(route)),
  };
}

function normalizeRoute(route) {
  if (!route.startsWith("/")) return `/${route}`;
  return route;
}

function parsePositiveIntegerEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (!rawValue || !rawValue.trim()) return defaultValue;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `${name} deve essere un numero intero positivo in millisecondi. ` +
        `Valore ricevuto: "${rawValue}". Esempio valido: ${name}=30000.`,
    );
  }

  return value;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function routeLabel(route, theme, viewport, authenticated) {
  return `${authenticated ? "auth" : "public"} ${viewport.name} ${theme} ${route}`;
}

function logAudit(message) {
  process.stderr.write(`[smoke:a11y] ${message}\n`);
}

function withTimeout(promise, ms, message) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
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
      env: {
        ...process.env,
        PRATIX_SMOKE_ACTION_LINK: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        VITE_TURNSTILE_SITE_KEY: "",
      },
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

async function newContext(browser, theme, viewport, storageState) {
  const context = await browser.newContext({
    colorScheme: theme,
    storageState,
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
  await page.goto(smokeActionLink, { waitUntil: "domcontentloaded" });
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
  const label = routeLabel(route, theme, viewport, authenticated);
  logAudit(`audit ${label}`);
  const currentPath = new URL(page.url(), baseUrl).pathname;
  if (currentPath !== route) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  }
  await page.waitForLoadState("networkidle", { timeout: 7_000 }).catch(() => undefined);
  await ensureDocumentReady(page, route);
  await page.addScriptTag({ content: axe.source });

  const result = await withTimeout(
    page.evaluate(async () => {
      return window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      });
    }),
    auditTimeoutMs,
    `Audit axe oltre ${auditTimeoutMs}ms per ${label}`,
  );

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
  let browser;
  const issues = [];
  let audited = 0;

  try {
    browser = await webkit.launch({ headless: true });

    for (const viewport of selectedViewports) {
      for (const theme of selectedThemes) {
        const context = await newContext(browser, theme, viewport);
        try {
          const page = await context.newPage();
          for (const route of selectedRoutes.public) {
            await auditPage(page, route, theme, viewport, false, issues);
            audited += 1;
          }
        } finally {
          await context.close().catch(() => undefined);
        }
      }
    }

    const canAuditAuth = Boolean(!publicOnly && supabaseUrl && smokeActionLink);
    if ((authRequired || selectedRoutes.authExplicit) && !canAuditAuth) {
      throw new Error(
        "Smoke autenticato richiesto ma non configurato. " +
          "Usa npm run smoke:a11y:auth per preparare una sessione test isolata.",
      );
    }

    const auditAuthRoutes = canAuditAuth && selectedRoutes.auth.length > 0;
    if (auditAuthRoutes) {
      const bootstrapContext = await newContext(browser, "light", VIEWPORTS[0]);
      const bootstrapPage = await bootstrapContext.newPage();
      await login(bootstrapPage);
      const authStorageState = await bootstrapContext.storageState();
      await bootstrapContext.close();

      for (const viewport of selectedViewports) {
        for (const theme of selectedThemes) {
          const context = await newContext(browser, theme, viewport, authStorageState);
          try {
            const page = await context.newPage();
            for (const route of selectedRoutes.auth) {
              await auditPage(page, route, theme, viewport, true, issues);
              audited += 1;
            }
          } finally {
            await context.close().catch(() => undefined);
          }
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          baseUrl,
          audited,
          authenticated: auditAuthRoutes,
          authMode: auditAuthRoutes ? "magiclink" : "none",
          quick: options.quick,
          routes: [...selectedRoutes.public, ...selectedRoutes.auth],
          viewports: selectedViewports.map((viewport) => viewport.name),
          themes: selectedThemes,
          issueCount: issues.length,
          issues: issues.slice(0, 40),
        },
        null,
        2,
      ),
    );
    if (issues.length) process.exitCode = 1;
  } finally {
    await browser?.close().catch(() => undefined);
  }
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
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(detail.replace(/([?&]token=)[^&\s]+/g, "$1[redatto]"));
    process.exitCode = 1;
  })
  .finally(() => {
    stopDevServer();
  });
