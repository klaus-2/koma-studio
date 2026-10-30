import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
    plugins: [react(), tailwindcss()],
    define: appVersionDefine(import.meta.url),
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
      rollupOptions: {
        // An unresolved bare specifier is externalized into the bundle;
        // WebView2 cannot resolve it and the whole module graph fails
        // (blank window). Fail the build instead of shipping it.
        onwarn(warning, warn) {
          if (warning.code === "UNRESOLVED_IMPORT") {
            throw new Error(
              `Unresolved import reached the production bundle: ${warning.message}`,
            );
          }
          warn(warning);
        },
        // No manualChunks: a catch-all vendor group hoisted every
        // node_modules module into the eager entry graph, including deps that
        // only route chunks import dynamically (ProseMirror, pako, pdf-lib,
        // the color picker, dropzone, virtual). Let Rollup split along the
        // real static/dynamic import graph so route-only deps stay lazy.
        output: {
          // Shared leaf modules (icons, tiny motion helpers) otherwise each
          // become their own request; on 3G every request pays a full RTT.
          experimentalMinChunkSize: 20_000,
        },
      },
    },
  };
});
