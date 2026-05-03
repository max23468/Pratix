export const PRATIX_DOCUMENTS_BUCKET = "pratix-documents";

export const PRATIX_STORAGE_AREAS = {
  invoices: "invoices",
  cases: "cases",
  expenses: "expenses",
  activities: "activities",
  billingExports: "billing-exports",
  imports: "imports",
  profile: "profile",
  exports: "exports",
} as const;

export type PratixStorageArea = (typeof PRATIX_STORAGE_AREAS)[keyof typeof PRATIX_STORAGE_AREAS];

function cleanPathSegment(value: string) {
  const cleaned = value
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180);

  return cleaned || "file";
}

export function buildPratixStoragePath({
  userId,
  area,
  fileName,
  ownerRecordId,
}: {
  userId: string;
  area: PratixStorageArea;
  fileName: string;
  ownerRecordId?: string;
}) {
  const parts = [cleanPathSegment(userId), area];

  if (ownerRecordId) {
    parts.push(cleanPathSegment(ownerRecordId));
  }

  parts.push(cleanPathSegment(fileName));
  return parts.join("/");
}

export function buildInvoiceStoragePath(userId: string, invoiceId: string, fileName: string) {
  return buildPratixStoragePath({
    userId,
    area: PRATIX_STORAGE_AREAS.invoices,
    ownerRecordId: invoiceId,
    fileName,
  });
}
