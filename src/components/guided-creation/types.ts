export type ExistingMode = "existing" | "new";
export type ClientKind = "individual" | "company";
export type CounterpartyKind = "individual" | "company" | "group";
export type ActivityStatus = "to_invoice" | "invoiced";
export type CaseStatus = "open" | "in_progress" | "suspended" | "closed" | "archived";

export type PrincipalRow = {
  id: string;
  business_name: string;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
};

export type ClientRow = {
  id: string;
  kind: ClientKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
};

export type CounterpartyRow = {
  id: string;
  kind: CounterpartyKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
};

export type PriceBookRow = {
  id: string;
  principal_id: string;
  year: number;
  status: string;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
};

export type PriceItemRow = {
  id: string;
  price_book_id: string;
  kind: "fee" | "expense_reimbursement";
  code: string;
  name: string;
  invoice_description: string | null;
  unit_price: number | null;
  requires_hearing_dates: boolean;
};

export type PriceOption = PriceItemRow & {
  principal_id: string;
  price_book_year: number;
  price_book_status: string;
  book_fees_enabled: boolean;
  book_expense_reimbursements_enabled: boolean;
};

export type ActivityDraft = {
  localId: string;
  activityId: string;
  activityDate: string;
  priceItemId: string;
  description: string;
  quantity: number;
  freeAmount: number;
  status: ActivityStatus;
  notes: string;
  hearingDates: HearingDateDraft[];
  attachmentFile: File | null;
  attachmentName: string;
  attachmentType: string;
  attachmentNotes: string;
};

export type HearingDateDraft = {
  localId: string;
  date: string;
};

export type GuidedCreationDraft = {
  principalMode: ExistingMode;
  principalId: string;
  principalName: string;
  clientMode: ExistingMode;
  clientId: string;
  clientKind: ClientKind;
  clientFirstName: string;
  clientLastName: string;
  clientBusinessName: string;
  counterpartyMode: ExistingMode;
  counterpartyId: string;
  counterpartyKind: CounterpartyKind;
  counterpartyFirstName: string;
  counterpartyLastName: string;
  counterpartyBusinessName: string;
  counterpartyNotes: string;
  practiceNumber: string;
  status: CaseStatus;
  openedAt: string;
  closedAt: string;
  authority: string;
  rgNumber: string;
  notes: string;
  activities: ActivityDraft[];
};

export type StagedGuidedCreation = {
  importId: string;
  rowId: string;
  status: "valid" | "warning" | "imported";
  normalized: NormalizedGuidedCreation;
  warnings: string[];
};

export type NormalizedGuidedCreation = {
  principal: {
    mode: ExistingMode;
    id: string | null;
    name: string;
  };
  client: {
    mode: ExistingMode;
    id: string | null;
    kind: ClientKind;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  counterparty: {
    mode: ExistingMode;
    id: string | null;
    kind: CounterpartyKind;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
    notes: string | null;
  };
  practice: {
    practiceNumber: number;
    existingCaseId?: string | null;
    status: CaseStatus;
    openedAt: string;
    closedAt: string | null;
    authority: string | null;
    rgNumber: string | null;
    notes: string | null;
  };
  activities: Array<{
    id: string;
    activityDate: string;
    priceBookId: string;
    priceBookYear: number;
    priceItemId: string;
    kind: "fee" | "expense_reimbursement";
    code: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    status: ActivityStatus;
    notes: string | null;
    hearingDates: string[];
  }>;
};

export type PreparedGuidedCreation = {
  normalized: NormalizedGuidedCreation;
  errors: string[];
  warnings: string[];
};
