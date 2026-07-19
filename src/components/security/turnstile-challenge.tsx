import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

const TURNSTILE_SCRIPT_ID = "pratix-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: "auto";
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function clearWidgetId(widgetIdRef: { current: string | null }) {
  widgetIdRef.current = null;
}

function loadTurnstileScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Turnstile non caricato")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile non caricato")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

type TurnstileChallengeProps = {
  action: "login" | "register";
  onTokenChange: (token: string | null) => void;
  resetSignal: number;
};

export function TurnstileChallenge({
  action,
  onTokenChange,
  resetSignal,
}: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Catturato in locale: il narrowing su un binding importato non sopravvive
    // alla closure della `.then()` sotto.
    const siteKey = TURNSTILE_SITE_KEY;
    if (!siteKey || !containerRef.current) {
      return;
    }

    let cancelled = false;
    let renderedWidgetId: string | null = null;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current || renderedWidgetId) {
          return;
        }

        renderedWidgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: "auto",
          callback: (token) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => onTokenChange(null),
        });
        widgetIdRef.current = renderedWidgetId;
      })
      .catch(() => onTokenChange(null));

    return () => {
      cancelled = true;
      if (renderedWidgetId && window.turnstile) {
        window.turnstile.remove(renderedWidgetId);
        clearWidgetId(widgetIdRef);
      }
    };
  }, [action, onTokenChange]);

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile) {
      return;
    }

    onTokenChange(null);
    window.turnstile.reset(widgetIdRef.current);
  }, [onTokenChange, resetSignal]);

  if (!TURNSTILE_SITE_KEY) {
    return null;
  }

  return <div ref={containerRef} className="min-h-16" />;
}
