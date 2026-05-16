import type { InvoiceStatus } from "@/lib/labels";

export function getUnpaidInvoiceStatus(dueDate: string | null | undefined, today = new Date()) {
  if (!dueDate) return "issued" satisfies InvoiceStatus;
  return dateOnlyKey(dueDate) < localDateKey(today)
    ? ("overdue" satisfies InvoiceStatus)
    : ("issued" satisfies InvoiceStatus);
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateOnlyKey(value: string) {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  return value.slice(0, 10);
}
