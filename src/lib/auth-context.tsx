import { createContext, use, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isInvalidRefreshTokenError(message: string) {
  return /invalid refresh token|refresh token not found/i.test(message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Listener PRIMA del getSession (raccomandato)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    // 2) Recupero sessione corrente
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) {
          setSession(null);

          if (isInvalidRefreshTokenError(error.message)) {
            await supabase.auth.signOut({ scope: "local" });
            return;
          }

          throw error;
        }

        setSession(data.session);
      })
      .catch((error: unknown) => {
        setSession(null);
        console.error("Impossibile recuperare la sessione Supabase.", error);
      })
      .finally(() => setLoading(false));

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}
