import { describe, expect, it } from "vitest";

import {
  buildNormalizedGuidedCreation,
  displayNormalizedClient,
  displayNormalizedCounterparty,
} from "./normalization";
import type {
  ActivityDraft,
  ClientRow,
  CounterpartyRow,
  GuidedCreationDraft,
  PriceOption,
  PrincipalRow,
} from "./types";

const principals: PrincipalRow[] = [
  {
    id: "principal-1",
    business_name: "Banca Test",
    fees_enabled: true,
    expense_reimbursements_enabled: true,
  },
];

const clients: ClientRow[] = [
  {
    id: "client-1",
    kind: "individual",
    first_name: "Ada",
    last_name: "Rossi",
    business_name: null,
  },
];

const counterparties: CounterpartyRow[] = [
  {
    id: "counterparty-1",
    kind: "company",
    first_name: null,
    last_name: null,
    business_name: "Controparte S.r.l.",
  },
];

const priceOptions: PriceOption[] = [
  {
    id: "fee-1",
    price_book_id: "book-2026",
    principal_id: "principal-1",
    price_book_year: 2026,
    price_book_status: "active",
    book_fees_enabled: true,
    book_expense_reimbursements_enabled: true,
    kind: "fee",
    code: "UD",
    name: "Udienza",
    invoice_description: null,
    unit_price: 120,
    requires_hearing_dates: true,
  },
  {
    id: "expense-1",
    price_book_id: "book-2026",
    principal_id: "principal-1",
    price_book_year: 2026,
    price_book_status: "active",
    book_fees_enabled: true,
    book_expense_reimbursements_enabled: true,
    kind: "expense_reimbursement",
    code: "ANT",
    name: "Anticipazione",
    invoice_description: null,
    unit_price: null,
    requires_hearing_dates: false,
  },
];

function activity(overrides: Partial<ActivityDraft> = {}): ActivityDraft {
  return {
    localId: "local-1",
    activityId: "activity-1",
    activityDate: "2026-02-03",
    priceItemId: "fee-1",
    description: " Udienza di trattazione ",
    quantity: 3,
    freeAmount: 0,
    status: "to_invoice",
    notes: " nota interna ",
    hearingDates: [
      { localId: "hearing-1", date: "2026-02-03" },
      { localId: "hearing-2", date: "2026-02-10" },
    ],
    attachmentFile: null,
    attachmentName: "",
    attachmentType: "",
    attachmentNotes: "",
    ...overrides,
  };
}

function draft(overrides: Partial<GuidedCreationDraft> = {}): GuidedCreationDraft {
  return {
    principalMode: "existing",
    principalId: "principal-1",
    principalName: "",
    clientMode: "existing",
    clientId: "client-1",
    clientKind: "company",
    clientFirstName: "",
    clientLastName: "",
    clientBusinessName: "",
    counterpartyMode: "existing",
    counterpartyId: "counterparty-1",
    counterpartyKind: "company",
    counterpartyFirstName: "",
    counterpartyLastName: "",
    counterpartyBusinessName: "",
    counterpartyNotes: "",
    practiceNumber: "157",
    status: "open",
    openedAt: "2026-01-02",
    closedAt: "",
    authority: " Tribunale di Milano ",
    rgNumber: " RG 42/2026 ",
    notes: " note pratica ",
    activities: [activity()],
    ...overrides,
  };
}

describe("normalizzazione creazione guidata", () => {
  it("normalizza soggetti esistenti e attivita con date udienza", () => {
    const result = buildNormalizedGuidedCreation(
      draft(),
      principals,
      clients,
      counterparties,
      priceOptions,
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.normalized.principal).toEqual({
      mode: "existing",
      id: "principal-1",
      name: "Banca Test",
    });
    expect(result.normalized.client).toEqual({
      mode: "existing",
      id: "client-1",
      kind: "individual",
      firstName: "Ada",
      lastName: "Rossi",
      businessName: null,
    });
    expect(result.normalized.practice).toMatchObject({
      practiceNumber: 157,
      openedAt: "2026-01-02",
      closedAt: null,
      authority: "Tribunale di Milano",
      rgNumber: "RG 42/2026",
      notes: "note pratica",
    });
    expect(result.normalized.activities[0]).toMatchObject({
      id: "activity-1",
      description: "Udienza di trattazione",
      quantity: 2,
      unitPrice: 120,
      notes: "nota interna",
      hearingDates: ["2026-02-03", "2026-02-10"],
    });
  });

  it("normalizza nuovi soggetti e segnala pratica senza attivita", () => {
    const result = buildNormalizedGuidedCreation(
      draft({
        principalMode: "new",
        principalId: "",
        principalName: " Nuovo Committente ",
        clientMode: "new",
        clientId: "",
        clientKind: "company",
        clientBusinessName: " Cliente S.r.l. ",
        counterpartyMode: "new",
        counterpartyId: "",
        counterpartyKind: "individual",
        counterpartyFirstName: "Mario",
        counterpartyLastName: "Bianchi",
        counterpartyNotes: " nota controparte ",
        activities: [],
      }),
      principals,
      clients,
      counterparties,
      priceOptions,
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(["La pratica verrà creata senza attività storiche."]);
    expect(result.normalized.principal.name).toBe("Nuovo Committente");
    expect(result.normalized.client.businessName).toBe("Cliente S.r.l.");
    expect(result.normalized.counterparty).toMatchObject({
      kind: "individual",
      firstName: "Mario",
      lastName: "Bianchi",
      notes: "nota controparte",
    });
    expect(displayNormalizedClient(result.normalized.client)).toBe("Cliente S.r.l.");
    expect(displayNormalizedCounterparty(result.normalized.counterparty)).toBe("Bianchi Mario");
  });

  it("usa importi liberi per i rimborsi e avvisa su attivita con nuovo committente", () => {
    const result = buildNormalizedGuidedCreation(
      draft({
        principalMode: "new",
        principalId: "",
        principalName: "Nuovo Committente",
        activities: [
          activity({
            priceItemId: "expense-1",
            description: " Anticipazione notifiche ",
            quantity: 4,
            freeAmount: 33.5,
            notes: "",
            hearingDates: [{ localId: "ignored", date: "2026-03-01" }],
          }),
        ],
      }),
      principals,
      clients,
      counterparties,
      priceOptions,
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      "Le attività storiche richiedono un committente esistente con Prezzi configurati.",
    ]);
    expect(result.normalized.activities[0]).toMatchObject({
      kind: "expense_reimbursement",
      quantity: 4,
      unitPrice: 33.5,
      notes: null,
      hearingDates: [],
    });
  });

  it("raccoglie errori di soggetti, pratica e attivita non valide", () => {
    const result = buildNormalizedGuidedCreation(
      draft({
        principalId: "missing-principal",
        clientId: "missing-client",
        counterpartyId: "missing-counterparty",
        practiceNumber: "0",
        activities: [
          activity({
            priceItemId: "missing-price",
            activityDate: "",
            description: " ",
            quantity: 0,
            freeAmount: -1,
            hearingDates: [{ localId: "empty", date: "" }],
          }),
          activity({
            localId: "local-2",
            activityId: "activity-2",
            activityDate: "2026-04-01",
            priceItemId: "fee-1",
            description: "",
            quantity: Number.NaN,
            hearingDates: [
              { localId: "filled", date: "2026-04-01" },
              { localId: "missing", date: "" },
            ],
          }),
        ],
      }),
      principals,
      clients,
      counterparties,
      priceOptions,
    );

    expect(result.normalized.activities).toHaveLength(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Inserisci un numero pratica numerico positivo.",
        "Seleziona un committente.",
        "Seleziona un cliente.",
        "Seleziona una controparte.",
        "Attività 1: seleziona una voce prezzo.",
        "Attività 2: inserisci la descrizione.",
        "Attività 2: completa tutte le date udienza.",
      ]),
    );
  });

  it("mostra fallback leggibili per soggetti normalizzati incompleti", () => {
    expect(
      displayNormalizedClient({
        mode: "new",
        id: null,
        kind: "individual",
        firstName: null,
        lastName: null,
        businessName: null,
      }),
    ).toBe("—");
    expect(
      displayNormalizedCounterparty({
        mode: "new",
        id: null,
        kind: "group",
        firstName: null,
        lastName: null,
        businessName: null,
        notes: null,
      }),
    ).toBe("Composta");
    expect(
      displayNormalizedCounterparty({
        mode: "new",
        id: null,
        kind: "company",
        firstName: null,
        lastName: null,
        businessName: null,
        notes: null,
      }),
    ).toBe("Società");
  });
});
