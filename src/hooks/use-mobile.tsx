import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const mobileMediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function useIsMobile() {
  return React.useSyncExternalStore(subscribeToMobileChanges, getMobileSnapshot, getServerSnapshot);
}

function subscribeToMobileChanges(onStoreChange: () => void) {
  const mql = window.matchMedia(mobileMediaQuery);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getMobileSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot() {
  return false;
}
