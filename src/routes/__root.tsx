import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { lazy, Suspense, type ReactNode } from "react";
import { AuthRedirectErrorNotice } from "@/components/auth-redirect-error-notice";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HOME_AUTH_REDIRECT_SCRIPT } from "@/lib/auth-home-redirect";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider, NO_FLASH_SCRIPT } from "@/lib/theme-context";
import { APP_VERSION } from "@/lib/version";

import appCss from "../styles.css?url";

const DEFAULT_DESCRIPTION =
  "Pratix è il gestionale per avvocati freelance che seguono pratiche di recupero crediti: committenti, clienti, controparti, attività e fatturazione.";
const SITE_URL = "https://pratix.vercel.app";
const OG_IMAGE_URL = `${SITE_URL}/og-image.jpg`;
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Pratix",
      url: SITE_URL,
      logo: `${SITE_URL}/app-icon-512.png`,
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Pratix",
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "it-IT",
      softwareVersion: APP_VERSION,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        category: "Fase iniziale gratuita",
      },
    },
  ],
};
const PUBLIC_ROUTE_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/recupera-password",
  "/reimposta-password",
  "/privacy",
  "/termini",
]);

const LazyAuthProvider = lazy(async () => {
  const { AuthProvider } = await import("@/lib/auth-context");
  return { default: AuthProvider };
});

function normalizeRoutePath(pathname: string) {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function isPublicRoutePath(pathname: string) {
  return PUBLIC_ROUTE_PATHS.has(normalizeRoutePath(pathname));
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-[120px] font-semibold leading-none text-primary">404</p>
        <h1 className="font-display mt-4 text-2xl font-semibold text-foreground">
          Pagina non trovata
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1a1f33", media: "(prefers-color-scheme: dark)" },
      { name: "theme-color", content: "#fbf8f1", media: "(prefers-color-scheme: light)" },
      { title: "Pratix" },
      {
        name: "description",
        content: DEFAULT_DESCRIPTION,
      },
      { name: "author", content: "Pratix" },
      { property: "og:title", content: "Pratix" },
      {
        property: "og:description",
        content: DEFAULT_DESCRIPTION,
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "it_IT" },
      { property: "og:site_name", content: "Pratix" },
      {
        property: "og:image",
        content: OG_IMAGE_URL,
      },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { property: "og:image:alt", content: "Pratix" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Pratix" },
      {
        name: "twitter:description",
        content: DEFAULT_DESCRIPTION,
      },
      {
        name: "twitter:image",
        content: OG_IMAGE_URL,
      },
      {
        name: "description",
        content: DEFAULT_DESCRIPTION,
      },
      {
        property: "og:description",
        content: DEFAULT_DESCRIPTION,
      },
      {
        name: "twitter:description",
        content: DEFAULT_DESCRIPTION,
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: HOME_AUTH_REDIRECT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Caricamento…</div>
    </div>
  );
}

function RouteAuthBoundary({ children }: { children: ReactNode }) {
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

function RootComponent() {
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
