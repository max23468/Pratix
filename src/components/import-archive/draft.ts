import type { ActivityDraft, HearingDateDraft, ImportDraft } from "./types";

export const today = () => new Date().toISOString().slice(0, 10);

export const makeActivity = (): ActivityDraft => ({
  localId: crypto.randomUUID(),
  activityId: crypto.randomUUID(),
  activityDate: today(),
  priceItemId: "",
  description: "",
  quantity: 1,
  freeAmount: 0,
  status: "to_invoice",
  notes: "",
  hearingDates: [],
  attachmentFile: null,
  attachmentName: "",
  attachmentType: "",
  attachmentNotes: "",
});

export const makeHearingDate = (date: string): HearingDateDraft => ({
  localId: crypto.randomUUID(),
  date,
});

export const initialDraft = (): ImportDraft => ({
  principalMode: "existing",
  principalId: "",
  principalName: "",
  clientMode: "existing",
  clientId: "",
  clientKind: "company",
  clientFirstName: "",
  clientLastName: "",
  clientBusinessName: "",
  counterpartyMode: "existing",
  counterpartyId: "",
  counterpartyKind: "company",
  counterpartyFirstName: "",
  counterpartyLastName: "",
  counterpartyBusinessName: "",
  counterpartyNotes: "",
  practiceNumber: "",
  title: "",
  status: "open",
  openedAt: today(),
  closedAt: "",
  authority: "",
  rgNumber: "",
  notes: "",
  activities: [],
});
