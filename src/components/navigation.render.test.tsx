import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./ui/sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/attivita" } }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/theme-context", () => ({
  useTheme: () => ({
    mode: "system",
    resolved: "dark",
    setMode: vi.fn(),
  }),
}));

describe("navigazione applicativa", () => {
  it("renderizza sidebar con voci principali, email utente e voce attiva", () => {
    const html = renderToString(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Committenti");
    expect(html).toContain("Attività");
    expect(html).toContain("Fatture");
    expect(html).toContain("avvocato@example.test");
    expect(html).toContain('data-active="true"');
  });

  it("renderizza menu utente compatto con iniziale account", () => {
    const html = renderToString(<UserMenu />);

    expect(html).toContain("Apri menu account");
    expect(html).toContain("A");
  });

  it("renderizza selettore tema compatto e completo", () => {
    const compact = renderToString(<ThemeToggle />);
    const full = renderToString(<ThemeToggle variant="full" className="test-class" />);

    expect(compact).toContain("Cambia tema");
    expect(full).toContain("Sistema");
    expect(full).toContain("test-class");
  });
});
