import { lazy, Suspense, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { isPublicRoutePath } from "@/lib/public-route-paths";
import { RootLoading } from "@/components/root/root-loading";

const LazyAuthProvider = lazy(async () => {
  const { AuthProvider } = await import("@/lib/auth-provider");
  return { default: AuthProvider };
});

export function RouteAuthBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (isPublicRoutePath(pathname)) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<RootLoading />}>
      <LazyAuthProvider>{children}</LazyAuthProvider>
    </Suspense>
  );
}
