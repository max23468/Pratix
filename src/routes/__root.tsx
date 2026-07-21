import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NotFoundComponent } from "@/components/root/not-found";
import { RootComponent } from "@/components/root/root-component";
import { HOME_AUTH_REDIRECT_SCRIPT } from "@/lib/auth-home-redirect";
import { NO_FLASH_SCRIPT } from "@/lib/theme-context";
import { DEFAULT_DESCRIPTION, OG_IMAGE_URL, STRUCTURED_DATA } from "@/lib/root-metadata";

import appCss from "../styles.css?url";

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

// Escape "<" (and "&") so a "</script>" or "<" inside the serialized JSON-LD
// cannot break out of the <script> element. See react.doctor/unsafe-json-in-html.
function jsonLdSafe(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/&/g, "\\u0026");
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdSafe(STRUCTURED_DATA) }}
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
