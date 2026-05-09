// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/brand/logo", () => ({
  Logo: () => <span>Pratix</span>,
}));

import { Route as PrivacyRoute } from "./privacy";
import { Route as TerminiRoute } from "./termini";

describe("route legali pubbliche", () => {
  it("renderizza privacy e termini con link alla home e metadati", () => {
    expect(PrivacyRoute.head().meta[0]).toEqual({ title: "Informativa sulla privacy · Pratix" });
    expect(TerminiRoute.head().meta[0]).toEqual({ title: "Termini di servizio · Pratix" });

    const { rerender } = render(<PrivacyRoute.component />);
    expect(screen.getByRole("heading", { name: "Informativa sulla privacy" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Torna alla home" })[0].getAttribute("href")).toBe(
      "/",
    );

    rerender(<TerminiRoute.component />);
    expect(screen.getByRole("heading", { name: "Termini di servizio" })).toBeTruthy();
    expect(screen.getByText(/gestione di pratiche di recupero crediti/)).toBeTruthy();
  });
});
