import { useSyncExternalStore } from "react";

function subscribe() {
  return () => undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function useClientMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
