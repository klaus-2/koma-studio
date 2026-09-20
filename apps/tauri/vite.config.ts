import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import path from "node:path";

// Tauri expects a fixed port and excludes src-tauri from HMR.
// https://v2.tauri.app/start/frontend/vite/

const host = process.env.TAURI_DEV_HOST;
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version?: string;
};
const appVersion = packageJson.version ?? "0.0.0";

export default defineConfig(async ({ mode }) => {
  const playwrightWebAccess =
    mode === "e2e" || process.env.VITE_PLAYWRIGHT_WEB_ACCESS === "1";
  const devHost = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __KOMA_APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      // Single React copy across workspaces: without this, Vite can emit two
      // dep-optimizer bundles of react/react-dom (different ?v= hashes) when a
      // workspace package resolves its own copy — hooks then see a dispatcher
      // from a different React instance ("Invalid hook call" / null useMemo).
      dedupe: ["react", "react-dom", "scheduler"],
      alias: {
        "@": path.resolve(__dirname, "../../packages/interface/src"),
        "@shared": path.resolve(__dirname, "../../packages/types/src"),
      },
    },

    // Pre-bundle the react entry points together so every importer (shell and
    // workspace packages) shares one optimized chunk and one ?v= hash.
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "scheduler"],
    },

    // Tauri keeps the default app-only dev host. Playwright opt-in mode binds
    // 127.0.0.1 so browser/MCP automation can reach the web app directly.
    clearScreen: false,
    server: {
      // Monorepo: allows running both apps in dev simultaneously (e.g. VITE_PORT=5176)
      port: Number(process.env.VITE_PORT ?? 5173),
      strictPort: true,
      host: host || (playwrightWebAccess ? devHost : false),
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: [
          "**/src-tauri/**",
          "**/.git/**",
          "**/.venv-mini/**",
          "**/dist/**",
          "**/release-desktop/**",
          "**/mini-backend/dist/**",
        ],
      },
    },
    preview: {
      port: 5173,
      strictPort: true,
    },
    build: {
      target: "es2022",
      sourcemap: false,
      chunkSizeWarningLimit: 3500,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (
              id.includes("/i18n/langs/") &&
              !id.includes("/i18n/langs/en")
            ) {
              const localeChunk = path.basename(id, path.extname(id));
              return `app-i18n-${localeChunk}`;
            }
            if (
              id.includes("/models/freeAiProviderCatalog") ||
              id.includes("/models/officialModelCatalog") ||
              id.includes("/models/translation-models-registry") ||
              id.includes("/models/aioStageCatalog") ||
              id.includes("/utils/customLlm")
            ) {
              return "app-model-catalog";
            }
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("/@tiptap/")) return "vendor-tiptap";
            if (
              id.includes("/react-markdown/") ||
              id.includes("/remark-gfm/")
            )
              return "vendor-markdown";
            if (id.includes("/@tanstack/react-query/")) return "vendor-query";
            if (id.includes("/driver.js/")) return "vendor-driver";
            if (id.includes("/uuid/")) return "vendor-utils";
            if (id.includes("/framer-motion/") || id.includes("/motion-dom/"))
              return "vendor-motion";
            if (
              id.includes("/lucide-react/") ||
              id.includes("/@radix-ui/") ||
              id.includes("/radix-ui/")
            ) {
              return "vendor-ui";
            }
            return "vendor";
          },
        },
      },
    },
  };
});
