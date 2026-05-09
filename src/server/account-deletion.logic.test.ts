import { describe, expect, it } from "vitest";

import {
  ACCOUNT_DELETE_CONFIRMATION,
  accountStoragePrefix,
  mergeStoragePaths,
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
  });
});
