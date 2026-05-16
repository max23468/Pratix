export const PASSKEYS_ENABLED = import.meta.env.VITE_ENABLE_PASSKEYS === "true";

export function passkeysUnavailableMessage() {
  return "Le passkey non sono ancora disponibili su questo progetto Supabase. Puoi continuare a usare il link via email.";
}
