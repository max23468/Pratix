// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "./table-row-navigation";

describe("table row navigation", () => {
  it("apre la riga con click e tastiera quando il target non è interattivo", () => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    row.appendChild(cell);
    const openRow = vi.fn();

    handleClickableTableRowClick(
      { target: cell, currentTarget: row } as unknown as Parameters<
        typeof handleClickableTableRowClick
      >[0],
      openRow,
    );

    const preventDefault = vi.fn();
    handleClickableTableRowKeyDown(
      {
        key: " ",
        target: cell,
        currentTarget: row,
        preventDefault,
      } as unknown as Parameters<typeof handleClickableTableRowKeyDown>[0],
      openRow,
    );

    expect(openRow).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("ignora target interattivi e tasti diversi da invio/spazio", () => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    const link = document.createElement("a");
    link.href = "/pratiche/PR-1";
    cell.appendChild(link);
    row.appendChild(cell);
    const openRow = vi.fn();

    handleClickableTableRowClick(
      { target: link, currentTarget: row } as unknown as Parameters<
        typeof handleClickableTableRowClick
      >[0],
      openRow,
    );
    handleClickableTableRowKeyDown(
      {
        key: "Escape",
        target: cell,
        currentTarget: row,
        preventDefault: vi.fn(),
      } as unknown as Parameters<typeof handleClickableTableRowKeyDown>[0],
      openRow,
    );
    handleClickableTableRowKeyDown(
      {
        key: "Enter",
        target: link,
        currentTarget: row,
        preventDefault: vi.fn(),
      } as unknown as Parameters<typeof handleClickableTableRowKeyDown>[0],
      openRow,
    );

    expect(openRow).not.toHaveBeenCalled();
  });
});
