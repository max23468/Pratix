import { today } from "./draft";
import type {
  CounterpartyRow,
  GuidedCreationDraft,
  NormalizedGuidedCreation,
  PriceOption,
  PrincipalRow,
  ClientRow,
} from "./types";
import { counterpartyKindLabels } from "@/lib/labels";

export function buildNormalizedGuidedCreation(
  draft: GuidedCreationDraft,
  principals: PrincipalRow[],
  clients: ClientRow[],
  counterparties: CounterpartyRow[],
  priceOptions: PriceOption[],
) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const selectedPrincipal = principals.find((principal) => principal.id === draft.principalId);
  const selectedClient = clients.find((client) => client.id === draft.clientId);
  const selectedCounterparty = counterparties.find(
    (counterparty) => counterparty.id === draft.counterpartyId,
  );

  const practiceNumber = Number(draft.practiceNumber);
  if (!Number.isInteger(practiceNumber) || practiceNumber <= 0) {
    errors.push("Inserisci un numero pratica numerico positivo.");
  }

  if (draft.principalMode === "existing" && !selectedPrincipal) {
    errors.push("Seleziona un committente.");
  }
  if (draft.principalMode === "new" && !draft.principalName.trim()) {
    errors.push("Inserisci la ragione sociale del nuovo committente.");
  }
  if (draft.clientMode === "existing" && !selectedClient) {
    errors.push("Seleziona un cliente.");
  }
  if (draft.clientMode === "new" && !displayDraftClient(draft)) {
    errors.push("Inserisci i dati del nuovo cliente.");
  }
  if (draft.counterpartyMode === "existing" && !selectedCounterparty) {
    errors.push("Seleziona una controparte.");
  }
  if (draft.counterpartyMode === "new" && !displayDraftCounterparty(draft)) {
    errors.push("Inserisci i dati della nuova controparte.");
  }

  const activities = draft.activities.map((activity, index) => {
    const item = priceOptions.find((option) => option.id === activity.priceItemId);
    if (!item) {
      errors.push(`Attività ${index + 1}: seleziona una voce prezzo.`);
      return null;
    }
    const quantity = item.requires_hearing_dates
      ? activity.hearingDates.filter((hearingDate) => Boolean(hearingDate.date)).length
      : Number(activity.quantity);
    const unitPrice =
      item.kind === "expense_reimbursement"
        ? Number(activity.freeAmount || 0)
        : Number(item.unit_price ?? 0);

    if (!activity.activityDate) errors.push(`Attività ${index + 1}: inserisci la data.`);
    if (!activity.description.trim())
      errors.push(`Attività ${index + 1}: inserisci la descrizione.`);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Attività ${index + 1}: inserisci una quantità positiva.`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push(`Attività ${index + 1}: inserisci un importo valido.`);
    }
    if (
      item.requires_hearing_dates &&
      activity.hearingDates.some((hearingDate) => !hearingDate.date)
    ) {
      errors.push(`Attività ${index + 1}: completa tutte le date udienza.`);
    }
    const hearingDates = activity.hearingDates.flatMap((hearingDate) =>
      hearingDate.date ? [hearingDate.date] : [],
    );

    return {
      id: activity.activityId,
      activityDate: activity.activityDate,
      priceBookId: item.price_book_id,
      priceBookYear: item.price_book_year,
      priceItemId: item.id,
      kind: item.kind,
      code: item.code,
      name: item.name,
      description: activity.description.trim(),
      quantity,
      unitPrice,
      status: activity.status,
      notes: activity.notes.trim() || null,
      hearingDates: item.requires_hearing_dates ? hearingDates : [],
    };
  });

  if (draft.activities.length === 0) {
    warnings.push("La pratica verrà creata senza attività storiche.");
  }
  if (draft.principalMode === "new" && draft.activities.length > 0) {
    warnings.push(
      "Le attività storiche richiedono un committente esistente con Prezzi configurati.",
    );
  }

  const normalized: NormalizedGuidedCreation = {
    principal: {
      mode: draft.principalMode,
      id: selectedPrincipal?.id ?? null,
      name: selectedPrincipal?.business_name ?? draft.principalName.trim(),
    },
    client: {
      mode: draft.clientMode,
      id: selectedClient?.id ?? null,
      kind: selectedClient?.kind ?? draft.clientKind,
      firstName: selectedClient?.first_name ?? trimOrNull(draft.clientFirstName),
      lastName: selectedClient?.last_name ?? trimOrNull(draft.clientLastName),
      businessName: selectedClient?.business_name ?? trimOrNull(draft.clientBusinessName),
    },
    counterparty: {
      mode: draft.counterpartyMode,
      id: selectedCounterparty?.id ?? null,
      kind: selectedCounterparty?.kind ?? draft.counterpartyKind,
      firstName: selectedCounterparty?.first_name ?? trimOrNull(draft.counterpartyFirstName),
      lastName: selectedCounterparty?.last_name ?? trimOrNull(draft.counterpartyLastName),
      businessName:
        selectedCounterparty?.business_name ?? trimOrNull(draft.counterpartyBusinessName),
      notes: trimOrNull(draft.counterpartyNotes),
    },
    practice: {
      practiceNumber: Number.isFinite(practiceNumber) ? practiceNumber : 0,
      existingCaseId: null,
      status: draft.status,
      openedAt: draft.openedAt || today(),
      closedAt: draft.closedAt || null,
      authority: trimOrNull(draft.authority),
      rgNumber: trimOrNull(draft.rgNumber),
      notes: trimOrNull(draft.notes),
    },
    activities: activities.filter(
      (activity): activity is NormalizedGuidedCreation["activities"][number] => Boolean(activity),
    ),
  };

  return { normalized, errors, warnings };
}
function displayDraftClient(draft: GuidedCreationDraft) {
  if (draft.clientKind === "company") return draft.clientBusinessName.trim();
  return [draft.clientFirstName, draft.clientLastName].filter(Boolean).join(" ").trim();
}

function displayDraftCounterparty(draft: GuidedCreationDraft) {
  if (draft.counterpartyKind === "individual") {
    return [draft.counterpartyLastName, draft.counterpartyFirstName]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return draft.counterpartyBusinessName.trim();
}

export function displayNormalizedClient(client: NormalizedGuidedCreation["client"]) {
  if (client.kind === "company") return client.businessName || "—";
  return [client.firstName, client.lastName].filter(Boolean).join(" ") || "—";
}

export function displayNormalizedCounterparty(
  counterparty: NormalizedGuidedCreation["counterparty"],
) {
  if (counterparty.kind === "individual") {
    return [counterparty.lastName, counterparty.firstName].filter(Boolean).join(" ") || "—";
  }
  return counterparty.businessName || counterpartyKindLabels[counterparty.kind] || "—";
}

function trimOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}
