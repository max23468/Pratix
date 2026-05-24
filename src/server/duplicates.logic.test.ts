import { describe, expect, it } from "vitest";
import {
  confidenceLabel,
  resolvedStatusLabel,
  reviewInsertFromCandidate,
  scanDuplicateCandidates,
  scanDuplicateDraft,
} from "./duplicates.logic";

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
        principal_id: "p1",
        client_id: "c1",
        counterparty_id: "cp1",
      },
      cases: [
        {
          id: "existing",
          public_code: "PR-00012",
          practice_number: 12,
          principal_id: "p1",
          client_id: "c1",
          counterparty_id: "cp1",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].reasons).toContain("Numero pratica uguale");
  });

  it("promuove clienti con email identica anche quando i nomi sono diversi", () => {
    const result = scanDuplicateCandidates({
      principals: [],
      clients: [
        {
          id: "a",
          public_code: "CL-00001",
          kind: "individual",
          first_name: "Mario",
          last_name: "Rossi",
          email: "cliente@example.test",
        },
        {
          id: "b",
          public_code: "CL-00002",
          kind: "individual",
          first_name: "Giulia",
          last_name: "Bianchi",
          email: " CLIENTE@example.test ",
        },
      ],
      counterparties: [],
      cases: [],
      reviews: [],
    });

    expect(result.openCandidates).toHaveLength(1);
    expect(result.openCandidates[0].score).toBe(0.96);
    expect(result.openCandidates[0].reasons).toContain("Email coincidente");
  });

  it("usa segnali fiscali e contatti per confermare committenti con nome debole", () => {
    const result = scanDuplicateCandidates({
      principals: [
        {
          id: "a",
          public_code: "CM-00001",
          business_name: "Alfa Gestioni",
          vat_number: "12345678901",
          tax_code: "12345678901",
          pec: "alfa@example.test",
        },
        {
          id: "b",
          public_code: "CM-00002",
          business_name: "Beta Servizi",
          vat_number: " 12345678901 ",
          tax_code: "12345678901",
          pec: "ALFA@example.test",
          email: "ALFA@example.test",
        },
      ],
      clients: [],
      counterparties: [],
      cases: [],
      reviews: [],
    });

    expect(result.openCandidates).toHaveLength(1);
    expect(result.openCandidates[0]).toMatchObject({
      entityType: "principal",
      confidence: "high",
      reasons: expect.arrayContaining([
        "Partita IVA coincidente",
        "Codice fiscale coincidente",
        "Contatto coincidente",
      ]),
    });
  });

  it("riconosce clienti società e persone con soglie diverse tra tool e form", () => {
    const toolResult = scanDuplicateCandidates({
      principals: [],
      clients: [
        {
          id: "company-a",
          public_code: "CL-00001",
          kind: "company",
          business_name: "Gamma S.r.l.",
          principalNames: ["Banca Alfa"],
        },
        {
          id: "company-b",
          public_code: "CL-00002",
          kind: "company",
          business_name: "Gamma srl",
          principalNames: ["Banca Alfa"],
        },
        {
          id: "person-a",
          public_code: "CL-00003",
          kind: "individual",
          first_name: "Mario",
          last_name: "Rossi",
        },
        {
          id: "person-b",
          public_code: "CL-00004",
          kind: "individual",
          first_name: "Rossi",
          last_name: "Mario",
        },
      ],
      counterparties: [],
      cases: [],
      reviews: [],
    });

    expect(toolResult.openCandidates.map((candidate) => candidate.left.id)).toEqual([
      "company-a",
      "person-a",
    ]);
    expect(toolResult.openCandidates[0].reasons).toContain("Ragione sociale quasi identica");

    const draftResult = scanDuplicateDraft({
      entityType: "client",
      draft: {
        kind: "individual",
        first_name: "Mario",
        last_name: "Rossi",
      },
      clients: [
        {
          id: "existing",
          public_code: "CL-00005",
          kind: "individual",
          first_name: "Mario",
          last_name: "Rossi",
        },
      ],
    });

    expect(draftResult).toHaveLength(1);
    expect(draftResult[0].right.id).toBe("draft");
  });

  it("usa soggetti interni simili per controparti composte", () => {
    const result = scanDuplicateCandidates({
      principals: [],
      clients: [],
      counterparties: [
        {
          id: "a",
          public_code: "CP-00001",
          kind: "group",
          business_name: "Debitori collegati",
          subjectLabels: ["Mario Rossi", "Beta S.r.l."],
        },
        {
          id: "b",
          public_code: "CP-00002",
          kind: "company",
          business_name: "Debitori collegati",
          subjectLabels: ["Mario Rossi"],
        },
      ],
      cases: [],
      reviews: [],
    });

    expect(result.openCandidates).toHaveLength(1);
    expect(result.openCandidates[0].reasons).toContain(
      "Soggetto interno simile nella controparte composta",
    );
    expect(result.openCandidates[0].left.fields.Tipo).toBe("Composta");
  });

  it("combina RG, autorità e contesto pratica senza richiedere sempre lo stesso titolo", () => {
    const result = scanDuplicateCandidates({
      principals: [],
      clients: [],
      counterparties: [],
      cases: [
        {
          id: "a",
          public_code: "PR-00001",
          practice_number: 101,
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-1",
          authority: "Tribunale di Roma",
          rg_number: "123/2026",
          principalName: "Banca Alfa",
          clientName: "Mario Rossi",
          counterpartyName: "Beta S.r.l.",
        },
        {
          id: "b",
          public_code: "PR-00002",
          practice_number: 102,
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-2",
          authority: "Tribunale di Roma",
          rg_number: "123/2026",
          principalName: "Banca Alfa",
          clientName: "Mario Rossi",
          counterpartyName: "Beta srl",
        },
      ],
      reviews: [],
    });

    expect(result.openCandidates).toHaveLength(1);
    expect(result.openCandidates[0].reasons).toEqual(
      expect.arrayContaining([
        "RG uguale o molto simile",
        "Stesso committente e cliente con controparte simile",
      ]),
    );
    expect(result.openCandidates[0].left.subtitle).toBe("Banca Alfa · Mario Rossi · Beta S.r.l.");
  });

  it("applica review aperte, rimandate e risolte senza perdere snapshot", () => {
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
          id: "review-open",
          entity_type: "principal",
          left_record_id: "a",
          right_record_id: "b",
          score: 0.97,
          confidence: "high",
          reasons: ["Ragione sociale quasi identica"],
          status: "snoozed",
          detected_at: "2026-05-01",
          resolved_at: null,
        },
        {
          id: "review-merged",
          entity_type: "client",
          left_record_id: "c",
          right_record_id: "d",
          score: 0.88,
          confidence: "medium",
          reasons: ["Nome e cognome molto simili"],
          status: "merged",
          kept_record_id: "c",
          merged_record_id: "d",
          snapshot: {
            left: { id: "c", publicCode: "CL-00003", label: "Mario Rossi" },
            right: { id: "d", publicCode: "CL-00004", label: "Mario Rosi" },
          },
        },
        {
          id: "review-without-snapshot",
          entity_type: "client",
          left_record_id: "x",
          right_record_id: "y",
          score: 0.8,
          confidence: "medium",
          reasons: ["Snapshot mancante"],
          status: "dismissed",
          snapshot: null,
        },
      ],
    });

    expect(result.openCandidates[0]).toMatchObject({
      reviewId: "review-open",
      status: "snoozed",
      detectedAt: "2026-05-01",
    });
    expect(result.resolvedCandidates).toHaveLength(1);
    expect(result.resolvedCandidates[0]).toMatchObject({
      reviewId: "review-merged",
      status: "merged",
      left: { id: "c" },
      right: { id: "d" },
    });
  });

  it("serializza decisioni e label operative per la persistenza", () => {
    const candidate = scanDuplicateCandidates({
      principals: [
        { id: "b", public_code: "CM-00002", business_name: "Acme srl" },
        { id: "a", public_code: "CM-00001", business_name: "ACME S.R.L." },
      ],
      clients: [],
      counterparties: [],
      cases: [],
      reviews: [],
    }).openCandidates[0];

    expect(reviewInsertFromCandidate("user-1", candidate)).toMatchObject({
      user_id: "user-1",
      entity_type: "principal",
      left_record_id: "a",
      right_record_id: "b",
      status: "open",
      snapshot: {
        left: { id: "a" },
        right: { id: "b" },
      },
    });
    expect(resolvedStatusLabel("open")).toBe("Aperto");
    expect(resolvedStatusLabel("snoozed")).toBe("Rimandato");
    expect(resolvedStatusLabel("dismissed")).toBe("Non duplicato");
    expect(resolvedStatusLabel("merged")).toBe("Unito");
    expect(confidenceLabel("high")).toBe("Alta");
    expect(confidenceLabel("medium")).toBe("Media");
    expect(confidenceLabel("low")).toBe("Bassa");
  });
});
