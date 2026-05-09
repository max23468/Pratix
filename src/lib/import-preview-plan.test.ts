import { describe, expect, it } from "vitest";
import { applyImportPreviewPlan, summarizeImportPreviewPlan } from "@/lib/import-preview-plan";

describe("import preview plan", () => {
  it("distingue righe da creare, aggiornare e ignorare", () => {
    const planned = applyImportPreviewPlan(
      [
        {
          rowNumber: 2,
          normalized: { practice: { practiceNumber: 10 } },
          errors: [],
          warnings: [],
        },
        {
          rowNumber: 3,
          normalized: { practice: { practiceNumber: 20 } },
          errors: [],
          warnings: [],
        },
        {
          rowNumber: 4,
          normalized: { practice: { practiceNumber: 10 } },
          errors: [],
          warnings: [],
        },
      ],
      [{ id: "case-20", practice_number: 20, title: "Pratica esistente" }],
    );

    expect(planned.map((row) => row.importPlan.action)).toEqual(["create", "update", "ignore"]);
    expect(planned[1].normalized?.practice.existingCaseId).toBe("case-20");
    expect(planned[1].warnings[0]).toContain("verrà aggiornata");
    expect(planned[2].errors[0]).toContain("duplicata");
    expect(summarizeImportPreviewPlan(planned)).toEqual({ create: 1, update: 1, ignore: 1 });
  });
});
