import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: 'electron/preload.ts',
      },
      // Ployfill the Electron and Node.js built-in modules for Renderer process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: {},
    }),
  ],
  resolve: {
    // Single React copy across workspaces: without this, Vite can emit two
    // dep-optimizer bundles of react/react-dom (different ?v= hashes) when a
    // workspace package resolves its own copy — hooks then see a dispatcher
    // from a different React instance ("Invalid hook call" / null useMemo).
    dedupe: ['react', 'react-dom', 'scheduler'],
    alias: {
      '@': path.resolve(__dirname, '../../packages/interface/src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'scheduler'],
  },
  server: {
    host: '127.0.0.1',
    // Monorepo: permite rodar os dois apps em dev simultaneamente (ex.: VITE_PORT=5175)
    port: Number(process.env.VITE_PORT ?? 5173),
    strictPort: true,
    watch: {
      ignored: [
        '**/.git/**',
        '**/.venv-mini/**',
        '**/.venv-premium/**',
        '**/.npm-cache/**',
        '**/dist/**',
        '**/dist-electron/**',
        '**/release-desktop/**',
        '**/backend-premium/**',
        '**/auth-server/**',
        '**/backend/**',
        '**/mini-backend/dist/**',
      ],
    },
    hmr: {
      host: '127.0.0.1',
      port: Number(process.env.VITE_PORT ?? 5173),
      protocol: 'ws',
    },
  },
  preview: {
    host: '127.0.0.1',
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/i18n/langs/')) {
            return 'app-i18n';
          }

          if (
            id.includes('/models/freeAiProviderCatalog') ||
            id.includes('/models/officialModelCatalog') ||
            id.includes('/models/translation-models-registry') ||
            id.includes('/models/aioStageCatalog') ||
            id.includes('/utils/premiumAi')
          ) {
            return 'app-model-catalog';
          }

          if (id.includes('/hooks/useToolTips')) {
            return 'app-tooltips';
          }

          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/@tiptap/')) {
            return 'vendor-tiptap';
          }

          if (id.includes('/react-markdown/') || id.includes('/remark-gfm/')) {
            return 'vendor-markdown';
          }

          if (id.includes('/@tanstack/react-query/')) {
            return 'vendor-query';
          }

          if (id.includes('/driver.js/')) {
            return 'vendor-driver';
          }

          if (id.includes('/uuid/')) {
            return 'vendor-utils';
          }

          if (id.includes('/framer-motion/') || id.includes('/motion-dom/')) {
            return 'vendor-motion';
          }

          if (
            id.includes('/lucide-react/') ||
            id.includes('/@radix-ui/') ||
            id.includes('/radix-ui/')
          ) {
            return 'vendor-ui';
          }

          return 'vendor';
        },
      },
    },
  },
});
