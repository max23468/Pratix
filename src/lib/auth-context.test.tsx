// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

import { useAuth } from "./auth-context";
import { AuthProvider } from "./auth-provider";

function Probe() {
  const { loading, user, signOut } = useAuth();
  return (
    <div>
      <span>{loading ? "caricamento" : (user?.email ?? "ospite")}</span>
      <button type="button" onClick={() => void signOut()}>
        esci
      </button>
    </div>
  );
}

function OutsideProviderProbe() {
  useAuth();
  return null;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabase.auth.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("espone la sessione corrente e permette il logout solo locale", async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1", email: "avvocato@example.test" },
        },
      },
      error: null,
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText("caricamento")).toBeTruthy();
    await screen.findByText("avvocato@example.test");

    await userEvent.click(screen.getByRole("button", { name: "esci" }));
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("pulisce la sessione locale quando il refresh token non è più valido", async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid Refresh Token: Refresh Token Not Found" },
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await screen.findByText("ospite");
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("richiede il provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<OutsideProviderProbe />)).toThrow("useAuth deve essere usato");

    vi.mocked(console.error).mockRestore();
  });

  it("recepisce i cambi sessione dal listener Supabase", async () => {
    let listener: ((event: string, session: { user: { email: string } } | null) => void) | null =
      null;
    supabase.auth.onAuthStateChange.mockImplementation((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await screen.findByText("ospite");
    listener?.("SIGNED_IN", { user: { email: "nuovo@example.test" } });

    await waitFor(() => expect(screen.getByText("nuovo@example.test")).toBeTruthy());
  });
});
