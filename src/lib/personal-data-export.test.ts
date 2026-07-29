import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  buildPersonalDataCsvArchive,
  buildPersonalDataJson,
  PERSONAL_DATA_TABLES,
  rowsToCsv,
  type PersonalDataPayload,
} from "./personal-data-export";

const payload = (): PersonalDataPayload => ({
  exportedAt: "2026-05-09T10:00:00.000Z",
  product: "Pratix",
  tables: {
    profiles: [{ id: "user-1", full_name: "Avv. Test", notes: "riga; con separatore" }],
    invoices: [{ number: "1", total_amount: 122.5, meta: { source: "fixture" } }],
  },
});

describe("personal data export", () => {
  it("mantiene l'elenco governato delle tabelle personali", () => {
    expect(PERSONAL_DATA_TABLES).toContain("profiles");
    expect(PERSONAL_DATA_TABLES).toContain("activity_attachments");
    expect(PERSONAL_DATA_TABLES).toContain("billing_exports");
    expect(PERSONAL_DATA_TABLES).toContain("import_rows");
  });

  it("serializza righe CSV con separatore italiano e oggetti JSON", () => {
    expect(rowsToCsv(payload().tables.profiles)).toBe(
      'full_name;id;notes\nAvv. Test;user-1;"riga; con separatore"',
    );
    expect(rowsToCsv(payload().tables.invoices)).toContain('"{""source"":""fixture""}"');
    expect(rowsToCsv([])).toBe("");
  });

  it("neutralizza formule nei campi testuali senza alterare numeri negativi", () => {
    expect(rowsToCsv([{ formula: "=1+1", spaced: " \t@SUM(A1:A2)", amount: -10 }])).toBe(
      "amount;formula;spaced\n-10;'=1+1;' \t@SUM(A1:A2)",
    );
  });

  it("genera JSON e ZIP CSV con manifest", () => {
    const json = buildPersonalDataJson(payload());
    expect(strFromU8(json.bytes)).toContain('"product": "Pratix"');

    const archive = unzipSync(buildPersonalDataCsvArchive(payload()).bytes);
    expect(Object.keys(archive).sort()).toEqual(["invoices.csv", "manifest.json", "profiles.csv"]);
    expect(strFromU8(archive["manifest.json"])).toContain('"profiles": 1');
    expect(strFromU8(archive["profiles.csv"])).toContain("Avv. Test");
  });
});
