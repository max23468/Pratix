import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      all: true,
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/server/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/lib/version.ts",
        "src/components/ui/**",
        "src/components/brand/**",
        "src/components/app-layout.tsx",
        "src/components/appearance-card.tsx",
        "src/components/coming-soon.tsx",
        "src/components/default-error.tsx",
        "src/components/page-header.tsx",
        "src/components/table-empty-state.tsx",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/operational",
    },
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
