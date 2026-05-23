import { Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthRedirectErrorNotice } from "@/components/auth-redirect-error-notice";
import { RouteAuthBoundary } from "@/components/root/route-auth-boundary";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/lib/theme-context";

export function RootComponent() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouteAuthBoundary>
          <TooltipProvider delayDuration={200}>
            <Outlet />
            <AuthRedirectErrorNotice />
            <Toaster richColors position="top-right" />
            <Analytics />
            <SpeedInsights />
          </TooltipProvider>
        </RouteAuthBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
