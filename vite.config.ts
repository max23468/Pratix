import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

function stripDependencyUseClientDirectives() {
  return {
    name: "strip-dependency-use-client-directives",
    transform(code: string, id: string) {
      if (!id.includes("node_modules")) return;
      if (!/^["']use client["'];?\s*/.test(code)) return;

      return {
        code: code.replace(/^["']use client["'];?\s*/, ""),
        map: null,
      };
    },
  };
}

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom)[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-tanstack",
              test: /node_modules[\\/]@tanstack[\\/]/,
              priority: 20,
            },
            {
              name: "vendor-supabase",
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (
          warning.message.includes("node_modules/") &&
          warning.message.includes("imported from external module") &&
          warning.message.includes("but never used")
        ) {
          return;
        }

        defaultHandler(warning);
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    stripDependencyUseClientDirectives(),
    tanstackStart(),
    nitro({
      // Rolldown 1.2.x can emit an undeclared namespace export when Nitro
      // splits the dynamically loaded SSR service (rolldown/rolldown#10734).
      // Keep the service in one chunk until the upstream fix is released.
      inlineDynamicImports: true,
    }),
    viteReact(),
    tailwindcss(),
  ],
});
