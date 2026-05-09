import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { ChangelogBell } from "@/components/changelog-bell";
import { UserMenu } from "@/components/user-menu";
import { GlobalSearch } from "@/components/global-search";

export function AppLayout({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  const { data: profile } = useQuery({
    enabled: !!session,
    queryKey: ["profile", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Caricamento…</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Link
              to="/dashboard"
              className="truncate rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Vai alla dashboard"
            >
              {profile?.business_name || profile?.full_name || "La mia professione"}
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <GlobalSearch />
              <ChangelogBell />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
      {profile && !profile.onboarding_completed && <OnboardingDialog />}
    </SidebarProvider>
  );
}
