import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("supabase/schema.sql", "utf8");
const latestBillingMigration = readFileSync(
  "supabase/migrations/20260807117000_ignore_excluded_billing_items.sql",
  "utf8",
);

function billingRpcDefinition(sql: string) {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.save_billing_invoice");
  const end = sql.indexOf("\n$$;", start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end + 4).trim();
}

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
  "duplicate_reviews",
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

  it("mantiene la RPC emissione fattura atomica e owner-scoped", () => {
    expect(schema).toContain("CREATE OR REPLACE FUNCTION public.set_invoice_issue_state");
    expect(schema).toContain("SECURITY INVOKER");
    expect(schema).toContain("v_user_id uuid := auth.uid()");
    expect(schema).toContain("UPDATE public.invoices");
    expect(schema).toContain("UPDATE public.case_activities");
    expect(schema).toContain("AND user_id = v_user_id");
    expect(schema).toContain(
      "REVOKE EXECUTE ON FUNCTION public.set_invoice_issue_state(uuid, boolean) FROM PUBLIC, anon",
    );
    expect(schema).toContain("GRANT EXECUTE ON FUNCTION public.set_invoice_issue_state");
  });

  it("mantiene schema canonico e ultima migrazione allineati sulla RPC fatture", () => {
    const definition = billingRpcDefinition(schema);

    expect(definition).toBe(billingRpcDefinition(latestBillingMigration));
    expect(schema).toContain("hearing_dates date[] NOT NULL DEFAULT '{}'::date[]");
    expect(definition.indexOf("INSERT INTO public.billing_runs")).toBeLessThan(
      definition.indexOf("PERFORM ca.id"),
    );
    expect(definition).toContain("WHERE item.status IN ('included', 'postponed')");
  });

  it("lega le relazioni operative al proprietario e ogni attività a una sola riga", () => {
    for (const constraint of [
      "cases_client_owner_fkey",
      "case_status_history_case_owner_fkey",
      "invoices_client_owner_fkey",
      "invoices_case_owner_fkey",
      "invoice_lines_invoice_owner_fkey",
    ]) {
      expect(schema).toContain(`CONSTRAINT ${constraint}`);
    }
    expect(schema).not.toContain("CONSTRAINT cases_client_id_fkey");
    expect(schema).not.toContain("CONSTRAINT invoices_client_id_fkey");
    expect(schema).not.toContain("CONSTRAINT invoice_lines_invoice_id_fkey");
    expect(schema).toContain("CREATE UNIQUE INDEX invoice_lines_case_activity_unique");
    expect(schema).toContain("WHERE case_activity_id IS NOT NULL");
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
