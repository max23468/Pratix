// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, navigateMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock("@/components/brand/logo", () => ({
  Logo: ({ form }: { form?: string }) => <span>{form === "mark" ? "Logo mark" : "Pratix"}</span>,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    size: _size,
    variant: _variant,
    ...props
  }: {
    children: ReactNode;
    size?: string;
    variant?: string;
  }) => <button {...props}>{children}</button>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

import { Route } from "./index";
import { routeComponent } from "./-route-test-utils";

const RouteComponent = routeComponent(Route);

describe("Landing pubblica", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("mostra subito il contenuto pubblico senza loader di autenticazione", () => {
    render(<RouteComponent />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Tutto");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("torna");
    expect(screen.queryByText("Caricamento…")).toBeNull();
  });

  it("rimanda alla dashboard se trova una sessione esistente", async () => {
    getSessionMock.mockResolvedValueOnce({
      data: { session: { user: { id: "user-test" } } },
      error: null,
    });

    render(<RouteComponent />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/dashboard", replace: true });
    });
  });
});
