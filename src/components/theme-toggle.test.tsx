// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { themeState, setMode } = vi.hoisted(() => ({
  themeState: { mode: "system", resolved: "light" },
  setMode: vi.fn(),
}));

vi.mock("@/lib/theme-context", () => ({
  useTheme: () => ({ ...themeState, setMode }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactElement }) => children,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuRadioGroup: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => <div onClick={() => onValueChange("dark")}>{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeState.mode = "system";
    themeState.resolved = "light";
  });

  it("mostra la label estesa e propaga il cambio tema", async () => {
    render(<ThemeToggle variant="full" />);

    expect(screen.getByRole("button", { name: "Cambia tema" })).toBeTruthy();
    expect(screen.getAllByText("Sistema").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByText("Scuro"));

    expect(setMode).toHaveBeenCalledWith("dark");
  });
});
