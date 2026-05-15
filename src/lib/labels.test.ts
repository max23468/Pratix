import { describe, expect, it } from "vitest";

import { activityCaseLabel } from "./case-activities";
import {
  caseActivityStatusLabels,
  clientDisplayName,
  compareCounterparties,
  counterpartyDisplayName,
  priceItemKindLabels,
} from "./labels";

describe("clientDisplayName", () => {
  it("usa ragione sociale per società e nome completo per privati", () => {
    expect(clientDisplayName({ kind: "company", business_name: "Alfa S.r.l." })).toBe(
      "Alfa S.r.l.",
    );
    expect(clientDisplayName({ kind: "individual", first_name: "Ada", last_name: "Rossi" })).toBe(
      "Ada Rossi",
    );
  });

  it("usa il placeholder quando i dati anagrafici non bastano", () => {
    expect(clientDisplayName({ kind: "company", business_name: null })).toBe("—");
    expect(counterpartyDisplayName({ kind: "individual", first_name: null, last_name: null })).toBe(
      "—",
    );
  });
});

describe("counterpartyDisplayName", () => {
  it("mostra le persone fisiche con cognome prima del nome", () => {
    expect(
      counterpartyDisplayName({ kind: "individual", first_name: "Luca", last_name: "Bianchi" }),
    ).toBe("Bianchi Luca");
  });

  it("ordina le controparti per il nome mostrato", () => {
    const sorted = [
      { id: "3", kind: "company", business_name: "Zeta S.r.l." },
      { id: "2", kind: "individual", first_name: "Anna", last_name: "Rossi" },
      { id: "1", kind: "individual", first_name: "Luca", last_name: "Bianchi" },
    ].sort(compareCounterparties);

    expect(sorted.map(counterpartyDisplayName)).toEqual([
      "Bianchi Luca",
      "Rossi Anna",
      "Zeta S.r.l.",
    ]);
  });
});

describe("activityCaseLabel", () => {
  it("compone l'etichetta operativa della Pratica con Cliente e Controparte", () => {
    expect(
      activityCaseLabel({
        id: "case-1",
        principal_id: "principal-1",
        client_id: "client-1",
        counterparty_id: "counterparty-1",
        practice_number: 42,
        clients: { kind: "individual", first_name: "Ada", last_name: "Rossi" },
        counterparties: { kind: "company", business_name: "Beta S.p.A." },
      }),
    ).toBe("Pratica 42 · Ada Rossi · Beta S.p.A.");
  });

  it("mantiene fallback stabili quando mancano collegamenti o numero pratica", () => {
    expect(
      activityCaseLabel({
        id: "case-2",
        principal_id: null,
        client_id: null,
        counterparty_id: null,
      }),
    ).toBe("Pratica - · - · -");
  });
});

describe("product labels", () => {
  it("mantiene le label centrali del glossario per Attività e Prezzi", () => {
    expect(caseActivityStatusLabels).toMatchObject({
      to_invoice: "Da fatturare",
      invoiced: "Fatturata",
    });
    expect(priceItemKindLabels).toMatchObject({
      fee: "Compenso",
      expense_reimbursement: "Rimborso spese",
    });
  });
});
