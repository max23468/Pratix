export const PASSKEYS_ENABLED = import.meta.env.VITE_ENABLE_PASSKEYS === "true";

export function passkeysUnavailableMessage() {
  return "Le passkey funzionano solo su pratix.vercel.app. Qui puoi continuare a usare il link via email.";
}
