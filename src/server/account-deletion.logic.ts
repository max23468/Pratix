import { PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";

export const ACCOUNT_DELETE_CONFIRMATION = "ELIMINA";

export type DeleteAccountInput = {
  confirmation: string;
};

export const ACCOUNT_DATA_DELETE_TABLE_ORDER = [
  "activity_attachments",
  "case_activity_hearings",
  "billing_run_items",
  "billing_exports",
  "invoice_lines",
  "import_rows",
  "case_credit_transfers",
  "case_status_history",
  "case_activities",
  "invoices",
  "billing_runs",
  "imports",
  "price_items",
  "price_books",
  "principal_clients",
  "counterparty_subjects",
  "cases",
  "clients",
  "counterparties",
  "principals",
  "profiles",
] as const;

export type AccountDataDeleteTable = (typeof ACCOUNT_DATA_DELETE_TABLE_ORDER)[number];

export function validateDeleteAccountInput(input: DeleteAccountInput) {
  if (!input || typeof input.confirmation !== "string") {
    throw new Error("Conferma eliminazione mancante");
  }

  if (input.confirmation.trim() !== ACCOUNT_DELETE_CONFIRMATION) {
    throw new Error(`Scrivi ${ACCOUNT_DELETE_CONFIRMATION} per confermare`);
  }

  return input;
}

export function accountStoragePrefix(userId: string) {
  return userId.trim();
}

export function mergeStoragePaths(...groups: Array<Array<string | null | undefined>>) {
  return Array.from(
    new Set(
      groups
        .flat()
        .filter((path): path is string => typeof path === "string" && path.trim().length > 0),
    ),
  ).sort();
}

export { PRATIX_DOCUMENTS_BUCKET };
