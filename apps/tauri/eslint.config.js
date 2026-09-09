// ESLint for the Tauri app — shared config (@koma/config/eslint) + local params.
// The 16 legacy god-files are exempt from linting in the current phase
// (see packages/config/eslint).

import { defineKomaEslintConfig } from "@koma/config/eslint";

export default defineKomaEslintConfig({
  sourceGlobs: [
    "../../packages/interface/src/**/*.{ts,tsx}",
    "interface/**/*.{ts,tsx}",
    "tests/**/*.{ts,tsx}",
  ],
  appIgnores: [
    "src-tauri/target/**",
    "src-tauri/gen/**",
    "mini-backend/**",
    "mini-backend-hardened/**",
    ".venv-mini/**",
    "tests/e2e/.artifacts/**",
    "tests/e2e/test-results/**",
    "tests/e2e/playwright-report/**",
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
  ],
});
