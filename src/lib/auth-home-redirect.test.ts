import { describe, expect, it } from "vitest";
import { hasPersistedSupabaseAuthSession, HOME_AUTH_REDIRECT_SCRIPT } from "./auth-home-redirect";

function createStorage(entries: Record<string, string>) {
  const keys = Object.keys(entries);

  return {
    length: keys.length,
    getItem: (key: string) => entries[key] ?? null,
    key: (index: number) => keys[index] ?? null,
  };
}

function runInlineScript(pathname: string, storage: ReturnType<typeof createStorage>) {
  const redirects: string[] = [];
  const windowLike = {
    location: {
      pathname,
      replace: (to: string) => redirects.push(to),
    },
  };
  const run = new Function("window", "localStorage", HOME_AUTH_REDIRECT_SCRIPT);

  run(windowLike, storage);

  return redirects;
}

describe("auth home redirect", () => {
  it("riconosce una sessione Supabase persistita", () => {
    const storage = createStorage({
      "sb-test-auth-token": JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 1_800_000_000,
      }),
    });

    expect(hasPersistedSupabaseAuthSession(storage)).toBe(true);
  });

  it("ignora chiavi Supabase diverse dalla sessione auth", () => {
    const storage = createStorage({
      "sb-test-auth-token-code-verifier": JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 1_800_000_000,
      }),
    });

    expect(hasPersistedSupabaseAuthSession(storage)).toBe(false);
  });

  it("ignora valori corrotti o incompleti", () => {
    const storage = createStorage({
      "sb-test-auth-token": "{",
      "sb-other-auth-token": JSON.stringify({
        access_token: "access-token",
      }),
    });

    expect(hasPersistedSupabaseAuthSession(storage)).toBe(false);
  });

  it("reindirizza dalla home prima dell'idratazione quando esiste una sessione persistita", () => {
    const storage = createStorage({
      "sb-test-auth-token": JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 1_800_000_000,
      }),
    });

    expect(runInlineScript("/", storage)).toEqual(["/dashboard"]);
  });

  it("non reindirizza altre route pubbliche", () => {
    const storage = createStorage({
      "sb-test-auth-token": JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 1_800_000_000,
      }),
    });

    expect(runInlineScript("/login", storage)).toEqual([]);
  });
});
