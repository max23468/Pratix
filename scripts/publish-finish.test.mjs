import assert from "node:assert/strict";
import { test } from "node:test";

import { verifySupabaseSiteUrl } from "./publish-finish.mjs";

const expected = {
  projectId: "project-id",
  siteUrl: "https://pratix.vercel.app/",
};
const supabaseToken = { source: "test", token: "token" };

test("il guard Supabase blocca la pubblicazione senza token", async () => {
  await assert.rejects(
    verifySupabaseSiteUrl({ expected, supabaseToken: { source: "", token: "" } }),
    /SUPABASE_ACCESS_TOKEN non configurato/,
  );
});

test("il guard Supabase blocca la pubblicazione se l'API non è disponibile", async () => {
  await assert.rejects(
    verifySupabaseSiteUrl({
      expected,
      request: async () => ({ ok: false, status: 503 }),
      supabaseToken,
    }),
    /Supabase Management API non disponibile: HTTP 503/,
  );
});

test("il guard Supabase blocca la pubblicazione se il Site URL diverge", async () => {
  await assert.rejects(
    verifySupabaseSiteUrl({
      expected,
      request: async () => ({
        json: async () => ({ site_url: "https://example.vercel.app/" }),
        ok: true,
      }),
      supabaseToken,
    }),
    /Site URL divergente/,
  );
});
