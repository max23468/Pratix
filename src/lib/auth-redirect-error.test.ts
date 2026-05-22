import { describe, expect, it } from "vitest";
import { readAuthRedirectError } from "./auth-redirect-error";

describe("readAuthRedirectError", () => {
  it("spiega un magic link scaduto o già usato", () => {
    const result = readAuthRedirectError(
      "https://pratix.vercel.app/dashboard#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );

    expect(result?.message).toBe(
      "Il link di accesso è scaduto o è già stato usato. Richiedine uno nuovo dalla pagina di accesso.",
    );
    expect(result?.cleanUrl).toBe("https://pratix.vercel.app/dashboard");
  });

  it("spiega i callback aperti nel browser sbagliato", () => {
    const result = readAuthRedirectError(
      "https://pratix.vercel.app/dashboard?error=access_denied&error_description=Code+verifier+missing",
    );

    expect(result?.message).toBe(
      "Il link non può essere completato in questo browser. Richiedine uno nuovo e aprilo nello stesso browser usato per richiederlo.",
    );
    expect(result?.cleanUrl).toBe("https://pratix.vercel.app/dashboard");
  });

  it("ripulisce solo i parametri auth preservando gli altri parametri", () => {
    const result = readAuthRedirectError(
      "https://pratix.vercel.app/login?from=email&error=invalid_request#section?error_code=bad_code&next=1",
    );

    expect(result?.message).toBe(
      "Il link di accesso non è valido. Richiedine uno nuovo e usa l'ultimo ricevuto.",
    );
    expect(result?.cleanUrl).toBe("https://pratix.vercel.app/login?from=email#section?next=1");
  });

  it("ignora URL senza errore auth", () => {
    expect(readAuthRedirectError("https://pratix.vercel.app/dashboard")).toBeNull();
  });
});
