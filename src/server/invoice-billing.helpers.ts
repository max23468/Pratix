export type BillingPartyDisplay = {
  kind?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

export const billingDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const billingPartyName = (party?: BillingPartyDisplay | null) => {
  if (!party) return "—";
  if (party.kind === "individual") {
    return [party.first_name, party.last_name].filter(Boolean).join(" ") || "—";
  }
  return party.business_name || "—";
};

export const nextBillingPeriodStart = (periodEnd: string) => {
  const date = new Date(`${periodEnd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
