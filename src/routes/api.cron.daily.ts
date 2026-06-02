import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROUTE = "/api/cron/daily";

type SupabaseKeepAliveError = {
  code?: string | null;
};

type SupabaseKeepAliveClient = {
  from: (table: "profiles") => {
    select: (
      columns: "id",
      options: { head: true },
    ) => {
      limit: (count: 1) => Promise<{ error: SupabaseKeepAliveError | null }>;
    };
  };
};

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

export async function runSupabaseKeepAlive(
  client: SupabaseKeepAliveClient = supabaseAdmin,
): Promise<{ ok: true }> {
  const { error } = await client.from("profiles").select("id", { head: true }).limit(1);

  if (error) {
    throw new Error(`Heartbeat Supabase fallito: ${error.code || "unknown"}`);
  }

  return { ok: true };
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

        try {
          await runSupabaseKeepAlive();
        } catch {
          logCron("error", "supabase_keepalive_failed", request, startedAt);
          return Response.json(
            { ok: false, error: "Heartbeat Supabase non riuscito" },
            { status: 502 },
          );
        }

        logCron("info", "supabase_keepalive_completed", request, startedAt);
        logCron("info", "cron_completed", request, startedAt);
        return Response.json({
          ok: true,
          service: "pratix",
          checkedAt: new Date().toISOString(),
          supabase: {
            keepAlive: "completed",
          },
        });
      },
    },
  },
});
