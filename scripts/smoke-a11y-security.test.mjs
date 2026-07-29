import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const runner = await readFile(new URL("./smoke-a11y.mjs", import.meta.url), "utf8");
const wrapper = await readFile(new URL("./smoke-a11y-auth.mjs", import.meta.url), "utf8");

test("la service role resta nel wrapper privilegiato e non raggiunge runner o dev server", () => {
  assert.doesNotMatch(runner, /createClient|auth\.admin|envValue\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(wrapper, /auth\.admin\.generateLink/);
  assert.match(wrapper, /SUPABASE_TELEMETRY_DISABLED: "1"/);
  assert.match(wrapper, /SUPABASE_SERVICE_ROLE_KEY: ""/);
  assert.match(runner, /SUPABASE_SERVICE_ROLE_KEY: ""/);
  assert.match(runner, /token=.*redatto/);
});
