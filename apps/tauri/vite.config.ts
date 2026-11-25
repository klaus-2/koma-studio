import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { appVersionDefine } from "@koma/config/vite";
import path from "node:path";

// Tauri expects a fixed port and excludes src-tauri from HMR.
// https://v2.tauri.app/start/frontend/vite/

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async ({ mode }) => {
  const playwrightWebAccess =
    mode === "e2e" || process.env.VITE_PLAYWRIGHT_WEB_ACCESS === "1";
  const devHost = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";

  return {
    plugins: [
      react(),
      babel({
        presets: [reactCompilerPreset()],
      }),
      tailwindcss(),
    ],
    define: appVersionDefine(import.meta.url),
    // ES worker bundles may code-split: the export workers hold dynamic
    // imports (pdf-lib, xlsx) that need legal chunks. The Vite default
    // worker.format "iife" fails the build with [vite:worker-import-meta-url].
    worker: {
      format: "es",
    },
    resolve: {
      // Single React copy across workspaces: without this, Vite can emit two
      // dep-optimizer bundles of react/react-dom (different ?v= hashes) when a
      // workspace package resolves its own copy — hooks then see a dispatcher
      // from a different React instance ("Invalid hook call" / null useMemo).
      dedupe: ["react", "react-dom", "scheduler"],
      alias: {
        "@": path.resolve(import.meta.dirname, "../../packages/interface/src"),
        "@shared": path.resolve(import.meta.dirname, "../../packages/types/src"),
      },
    },

    // Pre-bundle the react entry points together so every importer (shell and
    // workspace packages) shares one optimized chunk and one ?v= hash.
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client"],
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
          "**/e2e/**",
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
      rolldownOptions: {
        onwarn(warning, warn) {
          if (warning.code === "UNRESOLVED_IMPORT") {
            throw new Error(
              `Unresolved import reached the production bundle: ${warning.message}`,
            );
          }
          warn(warning);
        },
        output: {
          codeSplitting: {
            minSize: 20_000,
          },
        },
      },
    },
  };
});
