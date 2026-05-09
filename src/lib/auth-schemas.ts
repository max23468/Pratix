import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Inserisci un'email valida").max(255),
  password: z.string().min(6, "Almeno 6 caratteri").max(128),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Inserisci nome e cognome").max(120),
  email: z.string().trim().email("Email non valida").max(255),
  password: z.string().min(8, "Almeno 8 caratteri").max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Inserisci un'email valida").max(255),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Almeno 8 caratteri").max(128),
    confirm: z.string().min(8, "Almeno 8 caratteri").max(128),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Le password non coincidono",
    path: ["confirm"],
  });

export function getPasswordUpdateErrorMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("different") ||
    normalized.includes("same password") ||
    normalized.includes("new password")
  ) {
    return "La nuova password deve essere diversa da quella attuale.";
  }

  return "Impossibile aggiornare la password. Richiedi un nuovo link di recupero.";
}
