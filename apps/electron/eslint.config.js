// ESLint for the Electron app (v1) — shared config (@koma/config/eslint).
// v2 desktop shell gate: same legacy god-file list as the tauri app.

import { defineKomaEslintConfig, DEFAULT_LEGACY_DIRS } from "@koma/config/eslint";

export default [
  ...defineKomaEslintConfig({
    appIgnores: [
      "mini-backend/**",
      "mini-backend-hardened/**",
      ".venv-mini/**",
      "resources/**",
      "release-desktop/**",
      ".build-cache/**",
    ],
    sourceGlobs: [
      "interface/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "electron/**/*.ts",
    ],
    // Main process is a legacy Node surface: same downgrade as tauri
    // (hooks n/a, no-useless-assignment→warn, preserve-caught-error→off).
    // scripts/*.mjs is not covered here — it isn't in sourceGlobs and the
    // factory's scripts block already provides the necessary downgrade.
    legacyDirs: [
      ...DEFAULT_LEGACY_DIRS,
      "electron/**/*.ts",
    ],
    legacyFiles: [
      // Pre-existing v1 god-files: lint exempted, removed progressively.
      "interface/pages/Dashboard.tsx",
      "interface/pages/Settings.tsx",
      "interface/pages/ScanlationFeed.tsx",
      "interface/pages/KomaTopbar.tsx",
      "interface/components/dashboard/RenderTextPreview.tsx",
      "interface/components/dashboard/TextDetectionPreview.tsx",
      "interface/components/dashboard/watermark/WatermarkWorkspace.tsx",
      "interface/components/dashboard/optimizer/ChapterOptimizerWorkspace.tsx",
      "interface/components/blogger/BloggerWorkspace.tsx",
      "interface/hooks/useCleanerActions.ts",
      "interface/hooks/useAioManualStageExecutor.ts",
      "interface/hooks/useDashboardTour.ts",
      "interface/hooks/useDiscordRPC.ts",
      "interface/models/freeAiProviderCatalog.ts",
      "interface/models/translation-models-registry.ts",
      "interface/models/officialModelCatalog.ts",
      // Main process legacy (2.4k+ lines per file)
      "electron/preload.ts",
    ],
  }),
  // Main-process IPC parses binary payloads — \x00 inside regex is intentional.
  {
    files: ["electron/**/*.ts"],
    rules: {
      "no-control-regex": "off",
    },
  },
];
