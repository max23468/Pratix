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

  it("ordina numeri, date, booleani e valori vuoti con regole stabili", () => {
    const rows = [
      {
        name: "Senza data",
        amount: 0,
        dueDate: "",
        completed: false,
      },
      {
        name: "Fatto",
        amount: 10,
        dueDate: new Date("2026-05-02T00:00:00.000Z"),
        completed: true,
      },
      {
        name: "Da fare",
        amount: 5,
        dueDate: "2026-05-01",
        completed: false,
      },
    ];
    const richColumns = [
      ...columns,
      {
        key: "dueDate",
        label: "Scadenza",
        valueType: "date" as const,
        getValue: (row: (typeof rows)[number]) => row.dueDate,
      },
      {
        key: "completed",
        label: "Completato",
        valueType: "boolean" as const,
        getValue: (row: (typeof rows)[number]) => row.completed,
      },
    ] as const;

    expect(
      sortRows(rows, richColumns, { key: "amount", direction: "desc" }).map((row) => row.name),
    ).toEqual(["Fatto", "Da fare", "Senza data"]);
    expect(
      sortRows(rows, richColumns, { key: "dueDate", direction: "asc" }).map((row) => row.name),
    ).toEqual(["Da fare", "Fatto", "Senza data"]);
    expect(
      sortRows(rows, richColumns, { key: "completed", direction: "desc" }).map((row) => row.name),
    ).toEqual(["Fatto", "Senza data", "Da fare"]);
  });

  it("usa compare personalizzato, fallback e ordine originale come spareggio", () => {
    const rows = [
      { name: "B", amount: 1, priority: 2 },
      { name: "A", amount: 1, priority: 2 },
      { name: "C", amount: 1, priority: 1 },
    ];
    const customColumns = [
      {
        key: "priority",
        label: "Priorità",
        compare: (a: (typeof rows)[number], b: (typeof rows)[number]) => a.priority - b.priority,
        getValue: (row: (typeof rows)[number]) => row.priority,
      },
      {
        key: "amount",
        label: "Importo",
        valueType: "number" as const,
        getValue: (row: (typeof rows)[number]) => row.amount,
      },
    ] as const;

    expect(
      sortRows(rows, customColumns, { key: "priority", direction: "asc" }, (a, b) =>
        a.name.localeCompare(b.name),
      ).map((row) => row.name),
    ).toEqual(["C", "A", "B"]);
    expect(
      sortRows(rows, customColumns, { key: "amount", direction: "asc" }).map((row) => row.name),
    ).toEqual(["B", "A", "C"]);
  });

  it("restituisce una copia non ordinata quando la colonna non esiste", () => {
    const rows = [{ name: "B" }, { name: "A" }];
    const sorted = sortRows(rows, columns, { key: "missing", direction: "asc" });

    expect(sorted).toEqual(rows);
    expect(sorted).not.toBe(rows);
  });

  it("rispetta la direzione predefinita della colonna al primo click", () => {
    expect(nextTableSort({ key: "name", direction: "asc" }, columns[1])).toEqual({
      key: "amount",
      direction: "desc",
    });

    expect(nextTableSort({ key: "name", direction: "asc" }, columns[0])).toEqual({
      key: "name",
      direction: "desc",
    });
    expect(nextTableSort({ key: "amount", direction: "desc" }, columns[0])).toEqual({
      key: "name",
      direction: "asc",
    });
  });

  it("valida chiave e direzione arrivate dalla URL o dal database", () => {
    expect(parseTableSortKey("name", ["name", "amount"])).toBe("name");
    expect(parseTableSortKey(42, ["name", "amount"])).toBeUndefined();
    expect(parseTableSortKey("missing", ["name", "amount"])).toBeUndefined();
    expect(parseTableSortDirection("asc")).toBe("asc");
    expect(parseTableSortDirection("desc")).toBe("desc");
    expect(parseTableSortDirection("down")).toBeUndefined();
  });
});
