import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/routeTree.gen.ts",
        "src/integrations/supabase/types.ts",
        "src/lib/version.ts",
        "src/main.tsx",
        "src/components/ui/**",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/global",
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
