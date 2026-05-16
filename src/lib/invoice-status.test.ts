import { describe, expect, it } from "vitest";
import { getUnpaidInvoiceStatus } from "@/lib/invoice-status";

describe("getUnpaidInvoiceStatus", () => {
  const today = new Date(2026, 4, 16);

  it("keeps unpaid invoices issued when the due date has not passed", () => {
    expect(getUnpaidInvoiceStatus("2026-05-16", today)).toBe("issued");
    expect(getUnpaidInvoiceStatus("2026-05-17", today)).toBe("issued");
  });

  it("marks unpaid invoices overdue when the due date has passed", () => {
    expect(getUnpaidInvoiceStatus("2026-05-15", today)).toBe("overdue");
  });

  it("falls back to issued when there is no due date", () => {
    expect(getUnpaidInvoiceStatus(null, today)).toBe("issued");
  });
});
