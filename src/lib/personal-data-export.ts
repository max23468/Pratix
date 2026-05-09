import { strToU8, zipSync } from "fflate";

export const PERSONAL_DATA_TABLES = [
  "profiles",
  "principals",
  "principal_clients",
  "clients",
  "counterparties",
  "counterparty_subjects",
  "cases",
  "case_status_history",
  "case_credit_transfers",
  "case_activities",
  "case_activity_hearings",
  "activity_attachments",
  "price_books",
  "price_items",
  "billing_runs",
  "billing_run_items",
  "billing_exports",
  "invoices",
  "invoice_lines",
  "imports",
  "import_rows",
] as const;

export type PersonalDataTable = (typeof PERSONAL_DATA_TABLES)[number];

export type PersonalDataPayload = {
  exportedAt: string;
  product: "Pratix";
  tables: Record<string, unknown[]>;
};

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function rowsToCsv(rows: unknown[]) {
  const records = rows.filter((row): row is Record<string, unknown> => {
    return !!row && typeof row === "object" && !Array.isArray(row);
  });

  if (records.length === 0) return "";

  const headers = Array.from(new Set(records.flatMap((row) => Object.keys(row)))).sort();
  const lines = [
    headers.map(csvEscape).join(";"),
    ...records.map((row) => headers.map((header) => csvEscape(row[header])).join(";")),
  ];

  return lines.join("\n");
}

export function buildPersonalDataJson(payload: PersonalDataPayload) {
  return {
    bytes: strToU8(JSON.stringify(payload, null, 2)),
    mimeType: "application/json;charset=utf-8",
  };
}

export function buildPersonalDataCsvArchive(payload: PersonalDataPayload) {
  const entries: Record<string, Uint8Array> = {
    "manifest.json": strToU8(
      JSON.stringify(
        {
          exportedAt: payload.exportedAt,
          product: payload.product,
          tables: Object.fromEntries(
            Object.entries(payload.tables).map(([table, rows]) => [table, rows.length]),
          ),
        },
        null,
        2,
      ),
    ),
  };

  for (const [table, rows] of Object.entries(payload.tables)) {
    entries[`${table}.csv`] = strToU8(rowsToCsv(rows));
  }

  return {
    bytes: zipSync(entries),
    mimeType: "application/zip",
  };
}
