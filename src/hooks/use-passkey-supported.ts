import { useSyncExternalStore } from "react";

function subscribe() {
  return () => undefined;
}

function getClientSnapshot() {
  return "PublicKeyCredential" in window;
}

function getServerSnapshot() {
  return false;
}

export function usePasskeySupported() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
