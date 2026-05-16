import { describe, expect, it } from "vitest";
import { scanDuplicateCandidates, scanDuplicateDraft } from "./duplicates.logic";

describe("duplicates logic", () => {
  it("genera sospetti su committenti con ragione sociale quasi identica", () => {
    const result = scanDuplicateCandidates({
      principals: [
        { id: "a", public_code: "CM-00001", business_name: "ACME S.R.L." },
        { id: "b", public_code: "CM-00002", business_name: "Acme srl" },
      ],
      clients: [],
      counterparties: [],
      cases: [],
      reviews: [],
    });

    expect(result.openCandidates).toHaveLength(1);
    expect(result.openCandidates[0].confidence).toBe("high");
  });

  it("non ripropone coppie segnate come non duplicato", () => {
    const result = scanDuplicateCandidates({
      principals: [
        { id: "a", public_code: "CM-00001", business_name: "ACME S.R.L." },
        { id: "b", public_code: "CM-00002", business_name: "Acme srl" },
      ],
      clients: [],
      counterparties: [],
      cases: [],
      reviews: [
        {
          id: "review-1",
          entity_type: "principal",
          left_record_id: "a",
          right_record_id: "b",
          score: 0.98,
          confidence: "high",
          reasons: ["Ragione sociale quasi identica"],
          status: "dismissed",
          snapshot: {
            left: { id: "a", publicCode: "CM-00001", label: "ACME S.R.L." },
            right: { id: "b", publicCode: "CM-00002", label: "Acme srl" },
          },
        },
      ],
    });

    expect(result.openCandidates).toHaveLength(0);
    expect(result.resolvedCandidates).toHaveLength(1);
  });

  it("trova una pratica duplicata dal draft prima del salvataggio", () => {
    const result = scanDuplicateDraft({
      entityType: "case",
      draft: {
        id: "draft",
        public_code: null,
        practice_number: 12,
        title: "Recupero credito Rossi",
        principal_id: "p1",
        client_id: "c1",
        counterparty_id: "cp1",
      },
      cases: [
        {
          id: "existing",
          public_code: "PR-00012",
          practice_number: 12,
          title: "Recupero credito Rossi",
          principal_id: "p1",
          client_id: "c1",
          counterparty_id: "cp1",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].reasons).toContain("Numero pratica uguale");
  });
});
