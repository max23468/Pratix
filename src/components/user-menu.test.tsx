// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: { tab?: string };
    children: ReactNode;
  }) => <a href={search?.tab ? `${to}?tab=${search.tab}` : to}>{children}</a>,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { email: "avvocato@example.test" },
    signOut,
  }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactElement }) => children,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra account e richiama signOut dal menu", async () => {
    render(<UserMenu />);

    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("avvocato@example.test")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Profilo/i }).getAttribute("href")).toBe(
      "/account?tab=profilo",
    );
    expect(screen.getByRole("link", { name: /Accesso e sicurezza/i }).getAttribute("href")).toBe(
      "/account?tab=sicurezza",
    );
    expect(screen.getByRole("link", { name: /Aspetto/i }).getAttribute("href")).toBe(
      "/account?tab=aspetto",
    );
    expect(screen.getByRole("link", { name: /Notifiche/i }).getAttribute("href")).toBe(
      "/account?tab=notifiche",
    );
    expect(screen.getByRole("link", { name: /Dati/i }).getAttribute("href")).toBe(
      "/account?tab=dati",
    );

    await userEvent.click(screen.getByText("Esci"));

    expect(signOut).toHaveBeenCalled();
  });
});
