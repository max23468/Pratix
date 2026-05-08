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
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
});
