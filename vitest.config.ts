import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "electron/**/*.test.ts"],
    // Without this, vitest's default `**/*.test.ts` glob also matches the
    // compiled copies inside .next/standalone, silently doubling every count
    // (48 reported / 24 real).
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist*/**",
      "**/build/**",
      "**/.git/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
