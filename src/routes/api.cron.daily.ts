import { createFileRoute } from "@tanstack/react-router";

const ROUTE = "/api/cron/daily";

function logCron(
  level: "info" | "warn" | "error",
  message: string,
  request: Request,
  startedAt: number,
) {
  const payload = {
    level,
    message,
    route: ROUTE,
    requestId: request.headers.get("x-vercel-id"),
    ms: Date.now() - startedAt,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export const Route = createFileRoute("/api/cron/daily")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const startedAt = Date.now();
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
          logCron("error", "cron_secret_missing", request, startedAt);
          return Response.json({ ok: false, error: "Cron non configurato" }, { status: 503 });
        }

        if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
          logCron("warn", "cron_unauthorized", request, startedAt);
          return Response.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
        }

        logCron("info", "cron_completed", request, startedAt);
        return Response.json({
          ok: true,
          service: "pratix",
          checkedAt: new Date().toISOString(),
        });
      },
    },
  },
});
