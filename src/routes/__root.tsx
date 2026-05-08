import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider, NO_FLASH_SCRIPT } from "@/lib/theme-context";

import appCss from "../styles.css?url";

const DEFAULT_DESCRIPTION =
  "Pratix è il gestionale per avvocati freelance che seguono pratiche di recupero crediti: committenti, clienti, controparti, attività e fatturazione.";

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
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/gLsIYnhnwdgvDO7hJ37c2yvGWXu2/social-images/social-1777502938853-og-image.webp",
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
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/gLsIYnhnwdgvDO7hJ37c2yvGWXu2/social-images/social-1777502938853-og-image.webp",
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

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <Outlet />
            <Toaster richColors position="top-right" />
            <Analytics />
            <SpeedInsights />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
