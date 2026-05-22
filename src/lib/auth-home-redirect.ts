const SUPABASE_AUTH_KEY_PREFIX = "sb-";
const SUPABASE_AUTH_KEY_SUFFIX = "-auth-token";

type StorageReader = Pick<Storage, "getItem" | "key" | "length">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPersistedSupabaseSession(value: unknown) {
  const session = isRecord(value) && isRecord(value.currentSession) ? value.currentSession : value;

  return (
    isRecord(session) &&
    "access_token" in session &&
    "refresh_token" in session &&
    "expires_at" in session
  );
}

export function hasPersistedSupabaseAuthSession(storage: StorageReader) {
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (
      !key ||
      !key.startsWith(SUPABASE_AUTH_KEY_PREFIX) ||
      !key.endsWith(SUPABASE_AUTH_KEY_SUFFIX)
    ) {
      continue;
    }

    const rawValue = storage.getItem(key);
    if (!rawValue) continue;

    try {
      if (isPersistedSupabaseSession(JSON.parse(rawValue))) return true;
    } catch {
      continue;
    }
  }

  return false;
}

export const HOME_AUTH_REDIRECT_SCRIPT = `(() => {
  try {
    if (window.location.pathname !== '/') return;

    for (var i = 0; i < localStorage.length; i += 1) {
      var key = localStorage.key(i);
      if (!key || key.indexOf('sb-') !== 0 || key.slice(-11) !== '-auth-token') continue;

      var rawValue = localStorage.getItem(key);
      if (!rawValue) continue;

      var session = JSON.parse(rawValue);
      if (session && typeof session === 'object' && session.currentSession) {
        session = session.currentSession;
      }

      if (
        session &&
        typeof session === 'object' &&
        'access_token' in session &&
        'refresh_token' in session &&
        'expires_at' in session
      ) {
        window.location.replace('/dashboard');
        return;
      }
    }
  } catch (e) {}
})();`;
