// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Route } from "./dashboard";
import { routeComponent } from "./-route-test-utils";

const RouteComponent = routeComponent(Route);

const { dashboardData } = vi.hoisted(() => ({
  dashboardData: {
    casesWithoutActivities: 2,
    casesToComplete: 1,
    toInvoiceCount: 3,
    toInvoiceAmount: 1200,
    draftInvoiceCount: 4,
    invoicesToCollectAmount: 2400,
    overdueInvoiceCount: 1,
    expenseWithoutAttachmentCount: 2,
    principalSummaries: [],
    recentCases: [],
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
    children: ReactNode;
  }) => {
    const path = params
      ? Object.entries(params).reduce(
          (current, [key, value]) => current.replace(`$${key}`, value),
          to,
        )
      : to;
    const query = new URLSearchParams();
    Object.entries(search ?? {}).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const href = query.size > 0 ? `${path}?${query.toString()}` : path;

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "dashboard") {
      return { data: dashboardData, isLoading: false };
    }

    if (queryKey[0] === "dashboard-duplicate-summary") {
      return {
        data: { openCount: 0, highConfidenceCount: 0, snoozedCount: 0, resolvedCount: 0 },
        isLoading: false,
      };
    }

    return { data: undefined, isLoading: false };
  },
}));

vi.mock("@/components/app-layout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-test" } }),
}));

vi.mock("@/server/duplicates.functions", () => ({
  getDuplicateSummaryFn: vi.fn(),
}));

describe("Dashboard", () => {
  it("rende cliccabili le otto card operative", () => {
    render(<RouteComponent />);

    const expectedLinks = [
      ["Apri pratiche senza attività", "/pratiche?view=without_activities"],
      ["Apri pratiche da completare", "/pratiche?view=to_complete"],
      ["Apri attività da fatturare", "/attivita?status=to_invoice"],
      ["Apri maturato da fatturare", "/attivita?status=to_invoice&sort=amount&dir=desc"],
      ["Apri fatture in bozza", "/fatture?status=draft"],
      ["Apri fatture da incassare", "/fatture?status=to_collect"],
      ["Apri fatture scadute", "/fatture?status=expired"],
      [
        "Apri rimborsi senza allegato",
        "/attivita?status=to_invoice&kind=expense_reimbursement&attachments=missing",
      ],
    ];

    expectedLinks.forEach(([name, href]) => {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
    });
  });
});
