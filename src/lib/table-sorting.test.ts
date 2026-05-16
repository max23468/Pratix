import { describe, expect, it } from "vitest";
import {
  nextTableSort,
  parseTableSortDirection,
  parseTableSortKey,
  sortRows,
} from "./table-sorting";

describe("table sorting", () => {
  const columns = [
    {
      key: "name",
      label: "Nome",
      getValue: (row: { name: string }) => row.name,
    },
    {
      key: "amount",
      label: "Importo",
      valueType: "number" as const,
      defaultDirection: "desc" as const,
      getValue: (row: { amount: number }) => row.amount,
    },
  ] as const;

  it("ordina testo con collator italiano e confronto numerico naturale", () => {
    const rows = [{ name: "Mario 10" }, { name: "Mario 2" }, { name: "Anna" }];

    expect(
      sortRows(rows, columns, { key: "name", direction: "asc" }).map((row) => row.name),
    ).toEqual(["Anna", "Mario 2", "Mario 10"]);
  });

  it("rispetta la direzione predefinita della colonna al primo click", () => {
    expect(nextTableSort({ key: "name", direction: "asc" }, columns[1])).toEqual({
      key: "amount",
      direction: "desc",
    });
  });

  it("valida chiave e direzione arrivate dalla URL o dal database", () => {
    expect(parseTableSortKey("name", ["name", "amount"])).toBe("name");
    expect(parseTableSortKey("missing", ["name", "amount"])).toBeUndefined();
    expect(parseTableSortDirection("desc")).toBe("desc");
    expect(parseTableSortDirection("down")).toBeUndefined();
  });
});
