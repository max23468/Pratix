import { describe, expect, it } from "vitest";

import {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_DATA_DELETE_TABLE_ORDER,
  accountStoragePrefix,
  mergeStoragePaths,
  ownedStoragePaths,
  validateDeleteAccountInput,
} from "./account-deletion.logic";

describe("account deletion logic", () => {
  it("richiede conferma esplicita", () => {
    expect(validateDeleteAccountInput({ confirmation: ACCOUNT_DELETE_CONFIRMATION })).toEqual({
      confirmation: "ELIMINA",
    });
    expect(() => validateDeleteAccountInput({ confirmation: "elimina" })).toThrow("Scrivi");
  });

  it("normalizza prefix e deduplica path storage noti", () => {
    expect(accountStoragePrefix(" user-1 ")).toBe("user-1");
    expect(
      mergeStoragePaths(
        ["user-1/invoices/a.pdf", null, "user-1/invoices/a.pdf"],
        ["", "user-1/activities/b.pdf"],
      ),
    ).toEqual(["user-1/activities/b.pdf", "user-1/invoices/a.pdf"]);
    expect(
      ownedStoragePaths("user-1", [
        "user-1/invoices/a.pdf",
        "user-10/invoices/b.pdf",
        "user-1/../user-2/invoices/c.pdf",
      ]),
    ).toEqual(["user-1/invoices/a.pdf"]);
  });

  it("cancella le righe applicative prima dei parent con FK restrittive", () => {
    const order = ACCOUNT_DATA_DELETE_TABLE_ORDER;
    const before = (
      child: (typeof ACCOUNT_DATA_DELETE_TABLE_ORDER)[number],
      parent: (typeof ACCOUNT_DATA_DELETE_TABLE_ORDER)[number],
    ) => {
      expect(order.indexOf(child)).toBeLessThan(order.indexOf(parent));
    };

    before("billing_run_items", "case_activities");
    before("activity_attachments", "case_activities");
    before("invoice_lines", "invoices");
    before("case_activities", "price_items");
    before("case_activities", "clients");
    before("case_activities", "principals");
    before("case_credit_transfers", "clients");
    before("cases", "counterparties");
    before("price_books", "principals");
  });
});
