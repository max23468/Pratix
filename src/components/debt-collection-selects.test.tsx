// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { supabase } = vi.hoisted(() => {
  const dataFor = (table: string) => {
    if (table === "clients") {
      return {
        data: [
          {
            id: "client-1",
            kind: "company",
            first_name: null,
            last_name: null,
            business_name: "Alfa S.r.l.",
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  };
  const builderFor = (table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      then: (
        onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
        onrejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(dataFor(table)).then(onfulfilled, onrejected),
    };
    return builder;
  };
  return {
    supabase: {
      from: vi.fn((table: string) => builderFor(table)),
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select
      aria-label="select-test"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Seleziona</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

import { ClientSelect } from "./debt-collection-selects";

const renderWithClient = (node: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe("ClientSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("carica i clienti e propaga la selezione", async () => {
    const onValueChange = vi.fn();
    renderWithClient(<ClientSelect value={null} onValueChange={onValueChange} />);

    await screen.findByText("Alfa S.r.l.");
    await userEvent.selectOptions(screen.getByRole("combobox"), "client-1");

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("client-1"));
    expect(supabase.from).toHaveBeenCalledWith("clients");
  });
});
