// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingDialog } from "./onboarding-dialog";

const { toast, supabase, query } = vi.hoisted(() => {
  const query = {
    update: vi.fn((..._args: unknown[]) => query),
    eq: vi.fn(() => Promise.resolve({ error: null })),
  };
  return {
    toast: { success: vi.fn(), error: vi.fn() },
    query,
    supabase: { from: vi.fn((..._args: unknown[]) => query) },
  };
});

vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "avvocato@example.test" },
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const renderDialog = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderToString(
    <QueryClientProvider client={client}>
      <OnboardingDialog />
    </QueryClientProvider>,
  );
};

const renderInteractiveDialog = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OnboardingDialog />
    </QueryClientProvider>,
  );
};

describe("OnboardingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renderizza il primo passaggio di configurazione professionale", () => {
    const html = renderDialog();

    expect(html).toContain("Benvenuto in Pratix");
    expect(html).toContain("1. Anagrafica");
    expect(html).toContain("Ragione sociale / Denominazione");
    expect(html).toContain("P.IVA");
    expect(html).toContain("Codice fiscale");
  });

  it("valida il primo step e completa la configurazione profilo", async () => {
    renderInteractiveDialog();

    await userEvent.click(screen.getByRole("button", { name: "Continua" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Inserisci almeno la ragione sociale o il codice fiscale",
      ),
    );

    await userEvent.type(screen.getByLabelText("Ragione sociale / Denominazione"), " Avv. Test ");
    await userEvent.type(screen.getByLabelText("P.IVA"), " 12345678901 ");
    await userEvent.type(screen.getByLabelText("Provincia (sigla)"), "rm");
    await userEvent.click(screen.getByRole("button", { name: "Continua" }));

    await screen.findByLabelText("PEC");
    await userEvent.type(screen.getByLabelText("PEC"), " studio@example.test ");
    await userEvent.click(screen.getByRole("button", { name: "Continua" }));

    await screen.findByLabelText("IBAN");
    await userEvent.type(screen.getByLabelText("IBAN"), " it60x0542811101000000123456 ");
    await userEvent.type(screen.getByLabelText("Prefisso numerazione fatture (opz.)"), " FT ");
    await userEvent.click(screen.getByRole("button", { name: "Apri dashboard" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Configurazione completata"));
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: "Avv. Test",
        vat_number: "12345678901",
        address_province: "RM",
        pec: "studio@example.test",
        iban: "IT60X0542811101000000123456",
        invoice_number_prefix: "FT",
        onboarding_completed: true,
      }),
    );
  });
});
