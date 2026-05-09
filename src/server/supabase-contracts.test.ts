import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("supabase/schema.sql", "utf8");

const userOwnedTables = [
  "clients",
  "cases",
  "invoices",
  "invoice_lines",
  "principals",
  "principal_clients",
  "counterparties",
  "counterparty_subjects",
  "case_credit_transfers",
  "price_books",
  "price_items",
  "case_activities",
  "case_activity_hearings",
  "activity_attachments",
  "billing_runs",
  "billing_run_items",
  "billing_exports",
  "imports",
  "import_rows",
] as const;

describe("contratti Supabase recupero crediti", () => {
  it("mantiene RLS e 4 policy owner-scoped sulle tabelle user-owned", () => {
    for (const table of userOwnedTables) {
      expect(schema).toContain(`ALTER TABLE public.${table}`);
      expect(schema).toContain(`ALTER TABLE public.${table} `);
      expect(schema).toContain(`ENABLE ROW LEVEL SECURITY`);
      expect(schema).toContain(`CREATE POLICY ${table}_select_own ON public.${table}`);
      expect(schema).toContain(`CREATE POLICY ${table}_insert_own ON public.${table}`);
      expect(schema).toContain(`CREATE POLICY ${table}_update_own ON public.${table}`);
      expect(schema).toContain(`CREATE POLICY ${table}_delete_own ON public.${table}`);
      expect(schema).toContain(`(select auth.uid()) = user_id`);
    }
  });

  it("mantiene la RPC import come security invoker e filtrata per utente", () => {
    expect(schema).toContain("CREATE OR REPLACE FUNCTION public.apply_import_row");
    expect(schema).toContain("SECURITY INVOKER");
    expect(schema).toContain("v_user_id uuid := auth.uid()");
    expect(schema).toContain("WHERE id = p_import_row_id");
    expect(schema).toContain("AND user_id = v_user_id");
    expect(schema).toContain("status IN ('valid', 'warning')");
    expect(schema).toContain("coalesce((v_activity ->> 'id')::uuid, gen_random_uuid())");
    expect(schema).toContain("SET status = 'imported'");
  });

  it("mantiene storage owner-scoped su primo segmento path", () => {
    const migration = readFileSync(
      "supabase/migrations/20260503103536_add_private_storage_bucket.sql",
      "utf8",
    );

    expect(migration).toContain("'pratix-documents'");
    expect(migration).toContain("pratix_documents_owner_select");
    expect(migration).toContain("pratix_documents_owner_insert");
    expect(migration).toContain("pratix_documents_owner_update");
    expect(migration).toContain("pratix_documents_owner_delete");
    expect(migration).toContain("(storage.foldername(name))[1] = ((select auth.uid())::text)");
  });
});
