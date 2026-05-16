import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Inserisci un'email valida").max(255),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Inserisci nome e cognome").max(120),
  email: z.string().trim().email("Email non valida").max(255),
});
