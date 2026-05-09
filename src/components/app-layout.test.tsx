// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authState, navigate, supabase, query, maybeSingle } = vi.hoisted(() => {
  const authState = {
    session: null as null | { user: { id: string } },
    loading: false,
  };
  const maybeSingle = vi.fn();
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle,
  };
  return {
    authState,
    navigate: vi.fn(),
    query,
    maybeSingle,
    supabase: { from: vi.fn(() => query) },
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button type="button">menu</button>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <span aria-hidden="true" />,
}));

vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => <aside>sidebar</aside>,
}));

vi.mock("@/components/changelog-bell", () => ({
  ChangelogBell: () => <a href="/novita">Novità</a>,
}));

vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <button type="button">utente</button>,
}));

vi.mock("@/components/onboarding-dialog", () => ({
  OnboardingDialog: () => <div>onboarding</div>,
}));

import { AppLayout } from "./app-layout";

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.session = null;
    authState.loading = false;
    maybeSingle.mockResolvedValue({
      data: { business_name: "Avv. Test", full_name: null, onboarding_completed: false },
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("reindirizza al login quando non c'è sessione", async () => {
    render(<AppLayout>Area riservata</AppLayout>, { wrapper: Wrapper });

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login" }));
    expect(screen.getByText("Caricamento…")).toBeTruthy();
  });

  it("mostra layout, profilo e onboarding quando la sessione è valida", async () => {
    authState.session = { user: { id: "user-1" } };

    render(<AppLayout>Area riservata</AppLayout>, { wrapper: Wrapper });

    await screen.findByText("Avv. Test");
    expect(screen.getByText("Area riservata")).toBeTruthy();
    expect(screen.getByText("onboarding")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
