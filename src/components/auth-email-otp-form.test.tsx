// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEmailOtpForm } from "./auth-email-otp-form";

const { supabase, toastError } = vi.hoisted(() => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(),
    },
  },
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

describe("AuthEmailOtpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.verifyOtp.mockResolvedValue({ data: { session: { user: {} } }, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("verifica il codice monouso ricevuto via email", async () => {
    const onVerified = vi.fn();

    render(<AuthEmailOtpForm email="utente@example.com" onVerified={onVerified} />);

    await userEvent.type(screen.getByLabelText("Codice monouso"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Entra con codice" }));

    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: "utente@example.com",
        token: "123456",
        type: "email",
      });
    });
    expect(onVerified).toHaveBeenCalledWith();
  });

  it("blocca codici con lunghezza diversa da 6 cifre", async () => {
    render(<AuthEmailOtpForm email="utente@example.com" onVerified={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Codice monouso"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Entra con codice" }));

    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Inserisci il codice a 6 cifre");
  });
});
