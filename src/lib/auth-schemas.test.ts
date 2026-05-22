import { describe, expect, it } from "vitest";
import { loginSchema, oneTimeCodeSchema, registerSchema } from "./auth-schemas";

describe("loginSchema", () => {
  it("accetta email valide e normalizza gli spazi", () => {
    expect(loginSchema.parse({ email: " utente@example.com " })).toEqual({
      email: "utente@example.com",
    });
  });

  it("rifiuta email non valide", () => {
    const parsed = loginSchema.safeParse({ email: "utente" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Inserisci un'email valida");
    }
  });
});

describe("registerSchema", () => {
  it("accetta dati registrazione validi e normalizza il nome", () => {
    expect(
      registerSchema.parse({
        fullName: " Ada Rossi ",
        email: "ada@example.com",
      }),
    ).toEqual({
      fullName: "Ada Rossi",
      email: "ada@example.com",
    });
  });

  it("rifiuta nomi troppo corti", () => {
    const parsed = registerSchema.safeParse({
      fullName: "A",
      email: "ada@example.com",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Inserisci nome e cognome");
    }
  });
});

describe("oneTimeCodeSchema", () => {
  it("accetta codici a 6 cifre e normalizza gli spazi", () => {
    expect(oneTimeCodeSchema.parse(" 123 456 ")).toBe("123456");
  });

  it("rifiuta codici con lunghezza diversa", () => {
    const parsed = oneTimeCodeSchema.safeParse("12345678");

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Inserisci il codice a 6 cifre");
    }
  });
});
