import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../packages/interface/src"),
      "@shared": path.resolve(__dirname, "../../packages/types/src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["../../packages/interface/tests/setup.ts"],
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/src-tauri/**", "**/tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["interface/**/*.{ts,tsx}"],
      exclude: [
        "interface/**/*.{test,spec,stories}.{ts,tsx}",
        "interface/**/types.ts",
        "interface/**/*.types.ts",
        "interface/i18n/langs/**",
      ],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
    },
  },
});
