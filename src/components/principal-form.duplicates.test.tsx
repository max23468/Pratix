// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrincipalForm } from "./principal-form";

const { findDuplicates, toast, supabase, query } = vi.hoisted(() => {
  const findDuplicates = vi.fn();
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  };
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(),
  };
  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
    },
    from: vi.fn(() => query),
  };
  return { findDuplicates, toast, supabase, query };
});

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => findDuplicates,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useRouter: () => null,
}));

vi.mock("@/server/duplicates.functions", () => ({
  findDuplicateCandidatesFn: {},
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

const renderWithClient = (node: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe("PrincipalForm controllo duplicati", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    findDuplicates.mockResolvedValue([
      {
        entityType: "principal",
        left: {
          id: "principal-existing",
          publicCode: "COM-0001",
          label: "Banca Test S.r.l.",
          href: "/committenti/COM-0001",
        },
        right: {
          id: "draft",
          label: "Banca Test",
        },
        score: 0.94,
        confidence: "high",
        reasons: ["Ragione sociale quasi identica"],
        status: "open",
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it("ferma la creazione quando trova un committente potenzialmente duplicato", async () => {
    renderWithClient(<PrincipalForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Ragione sociale"), "Banca Test");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Controlla i potenziali duplicati prima di creare il committente",
      ),
    );
    expect(screen.getByText(/Potrebbe già esistere un/)).toBeTruthy();
    expect(screen.getByText("Banca Test S.r.l.")).toBeTruthy();
    expect(query.insert).not.toHaveBeenCalled();
  });
});
