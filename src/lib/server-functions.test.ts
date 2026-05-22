import { beforeEach, describe, expect, it, vi } from "vitest";
import { canUseAuthHeaders, getAuthHeaders, readServerResult } from "./server-functions";

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
  } as { getSession?: ReturnType<typeof vi.fn> },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
}));

describe("server functions helpers", () => {
  beforeEach(() => {
    supabaseMock.auth.getSession = vi.fn();
  });

  it("normalizza risultati diretti, payload data e Response JSON/testo", async () => {
    await expect(readServerResult({ ok: true })).resolves.toEqual({ ok: true });
    await expect(readServerResult({ data: { ok: true } })).resolves.toEqual({ ok: true });
    await expect(
      readServerResult(
        new Response(JSON.stringify({ data: { ok: true } }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(readServerResult(new Response("testo semplice"))).resolves.toBe("testo semplice");
  });

  it("propaga errori Response e richiede una sessione per gli header auth", async () => {
    await expect(
      readServerResult(new Response("Non autorizzato", { status: 401 })),
    ).rejects.toThrow("Non autorizzato");

    supabaseMock.auth.getSession?.mockResolvedValueOnce({
      data: { session: { access_token: "token-test" } },
    });
    await expect(getAuthHeaders()).resolves.toEqual({ Authorization: "Bearer token-test" });

    supabaseMock.auth.getSession?.mockResolvedValueOnce({ data: { session: null } });
    await expect(getAuthHeaders()).rejects.toThrow("Sessione non valida");
  });

  it("rileva quando gli header autenticati possono essere usati", () => {
    expect(canUseAuthHeaders()).toBe(true);
    delete supabaseMock.auth.getSession;
    expect(canUseAuthHeaders()).toBe(false);
  });
});
