// vitest.browser.config.ts
//
// Vitest "browser mode" using Playwright as the provider.
// Used for component tests that require real DOM, real layout, and real
// browser APIs (canvas, clipboard, drag/drop) instead of jsdom.
//
// Run with:
//   bun run test:browser            # headless chromium
//   bun run test:browser:headed     # with UI
//
// Default unit/integration tests stay on jsdom via vitest.config.ts —
// browser mode is opt-in for components whose tests genuinely need a
// real browser engine.

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./interface"),
      "@shared": path.resolve(__dirname, "../../packages/types/src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "interface/**/*.browser.{test,spec}.{ts,tsx}",
      "tests/browser/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/src-tauri/**",
      "**/tests/e2e/**",
    ],
    browser: {
      enabled: true,
      provider: "playwright",
      // Vitest browser mode supports `instances` for multi-browser fanout.
      // Phase 1 baseline runs Chromium only; Phase 2 adds WebKit/Firefox.
      instances: [
        { browser: "chromium" },
      ],
      headless: true,
      screenshotFailures: false,
      api: {
        host: "127.0.0.1",
        port: 5174,
      },
    },
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
    },
  },
});
