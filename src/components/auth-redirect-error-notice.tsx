import { useEffect } from "react";
import { toast } from "sonner";
import { readAuthRedirectError } from "@/lib/auth-redirect-error";

export function AuthRedirectErrorNotice() {
  useEffect(() => {
    const notice = readAuthRedirectError(window.location.href);

    if (!notice) return;

    window.history.replaceState(window.history.state, document.title, notice.cleanUrl);
    toast.error(notice.message);
  }, []);

  return null;
}
