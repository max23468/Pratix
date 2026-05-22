// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

import { AuthRedirectErrorNotice } from "./auth-redirect-error-notice";

describe("AuthRedirectErrorNotice", () => {
  beforeEach(() => {
    toastError.mockClear();
    window.history.replaceState(null, "", "/");
  });

  it("mostra un errore specifico e ripulisce l'URL del magic link", async () => {
    window.history.replaceState(
      null,
      "",
      "/dashboard#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );

    render(<AuthRedirectErrorNotice />);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Il link di accesso è scaduto o è già stato usato. Richiedine uno nuovo dalla pagina di accesso.",
      );
    });
    expect(window.location.pathname).toBe("/dashboard");
    expect(window.location.hash).toBe("");
  });

  it("non mostra toast senza errore auth nel redirect", async () => {
    window.history.replaceState(null, "", "/dashboard");

    render(<AuthRedirectErrorNotice />);

    await waitFor(() => expect(toastError).not.toHaveBeenCalled());
  });
});
