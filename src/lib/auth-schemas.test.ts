import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  getPasswordUpdateErrorMessage,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth-schemas";

describe("loginSchema", () => {
  it("accetta credenziali valide e normalizza gli spazi dell'email", () => {
    expect(loginSchema.parse({ email: " utente@example.com ", password: "secret" })).toEqual({
      email: "utente@example.com",
      password: "secret",
    });
  });

  it("rifiuta email non valide", () => {
    const parsed = loginSchema.safeParse({ email: "utente", password: "secret" });

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
        password: "password-sicura",
      }),
    ).toEqual({
      fullName: "Ada Rossi",
      email: "ada@example.com",
      password: "password-sicura",
    });
  });

  it("rifiuta password troppo corte", () => {
    const parsed = registerSchema.safeParse({
      fullName: "Ada Rossi",
      email: "ada@example.com",
      password: "1234567",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Almeno 8 caratteri");
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accetta email valide dopo trim", () => {
    expect(forgotPasswordSchema.parse({ email: " recupero@example.com " })).toEqual({
      email: "recupero@example.com",
    });
  });
});

describe("resetPasswordSchema", () => {
  it("accetta password e conferma coincidenti", () => {
    expect(
      resetPasswordSchema.parse({
        password: "password-sicura",
        confirm: "password-sicura",
      }),
    ).toEqual({
      password: "password-sicura",
      confirm: "password-sicura",
    });
  });

  it("rifiuta password e conferma diverse", () => {
    const parsed = resetPasswordSchema.safeParse({
      password: "password-sicura",
      confirm: "password-diversa",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Le password non coincidono");
    }
  });
});

describe("getPasswordUpdateErrorMessage", () => {
  it("riconosce gli errori Supabase di password invariata", () => {
    expect(getPasswordUpdateErrorMessage("New password should be different")).toBe(
      "La nuova password deve essere diversa da quella attuale.",
    );
  });

  it("usa il messaggio generico per errori non riconosciuti", () => {
    expect(getPasswordUpdateErrorMessage("token expired")).toBe(
      "Impossibile aggiornare la password. Richiedi un nuovo link di recupero.",
    );
  });
});
