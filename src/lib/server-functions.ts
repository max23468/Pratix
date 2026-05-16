import { supabase } from "@/integrations/supabase/client";

const unwrapServerResult = <T>(result: T | { data: T }) =>
  "data" in Object(result) ? (result as { data: T }).data : (result as T);

export async function readServerResult<T>(result: T | { data: T } | Response) {
  if (result instanceof Response) {
    if (!result.ok) throw new Error(await result.text());
    const contentType = result.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) return unwrapServerResult<T>(await result.json());
    return (await result.text()) as T;
  }
  return unwrapServerResult<T>(result);
}

export async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione non valida. Accedi di nuovo.");
  return { Authorization: `Bearer ${token}` };
}

export function canUseAuthHeaders() {
  return typeof supabase.auth?.getSession === "function";
}
