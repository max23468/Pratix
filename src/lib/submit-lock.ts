import { useCallback, useRef } from "react";

export function useSubmitLock() {
  const lockedRef = useRef(false);

  const acquire = useCallback(() => {
    if (lockedRef.current) return false;
    lockedRef.current = true;
    return true;
  }, []);

  const release = useCallback(() => {
    lockedRef.current = false;
  }, []);

  return { acquire, release };
}
