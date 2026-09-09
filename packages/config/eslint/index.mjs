// Shared ESLint flat config for the KŌMA monorepo.
//
// Factory derived from the historical Tauri app config (v2). Goals (mirroring
// ENGINEERING-STANDARDS): strict TypeScript, react-hooks/exhaustive-deps as
// ERROR in new code, no console.log in production, controlled degradation on
// large legacy files (currently exempt, removed progressively).
//
// App usage (eslint runs in the app directory, globs relative to cwd):
//
//   import { defineKomaEslintConfig } from "@koma/config/eslint";
//   export default defineKomaEslintConfig({
//     appIgnores: ["src-tauri/target/**", ...],
//     legacyFiles: ["interface/pages/Dashboard.tsx", ...],
//   });

import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";

const COMMON_GLOBALS = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  queueMicrotask: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  fetch: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Blob: "readonly",
  File: "readonly",
  FormData: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  crypto: "readonly",
  performance: "readonly",
  HTMLElement: "readonly",
  HTMLInputElement: "readonly",
  HTMLButtonElement: "readonly",
  HTMLDivElement: "readonly",
  HTMLImageElement: "readonly",
  HTMLCanvasElement: "readonly",
  HTMLVideoElement: "readonly",
  HTMLAudioElement: "readonly",
  HTMLAnchorElement: "readonly",
  HTMLFormElement: "readonly",
  HTMLSelectElement: "readonly",
  HTMLTextAreaElement: "readonly",
  KeyboardEvent: "readonly",
  MouseEvent: "readonly",
  PointerEvent: "readonly",
  TouchEvent: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  EventTarget: "readonly",
  Image: "readonly",
  ResizeObserver: "readonly",
  IntersectionObserver: "readonly",
  MutationObserver: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  indexedDB: "readonly",
  matchMedia: "readonly",
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  global: "readonly",
  globalThis: "readonly",
  module: "readonly",
  require: "readonly",
};

const NODE_GLOBALS = {
  ...COMMON_GLOBALS,
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
};

// interface/ legacy surfaces: hooks downgraded to warn until the large legacy
// files are rewritten. Inherited from the v1 line — same in both apps.
export const DEFAULT_LEGACY_DIRS = [
  "interface/components/**/*.{ts,tsx}",
  "interface/hooks/**/*.{ts,tsx}",
  "interface/pages/**/*.{ts,tsx}",
  "interface/contexts/**/*.{ts,tsx}",
  "interface/services/**/*.{ts,tsx}",
  "interface/models/**/*.{ts,tsx}",
  "interface/utils/**/*.{ts,tsx}",
  "interface/typography/**/*.{ts,tsx}",
  "interface/i18n/**/*.{ts,tsx}",
  "interface/legal/**/*.{ts,tsx}",
  "interface/workspace/**/*.{ts,tsx}",
  "interface/widgets/**/*.{ts,tsx}",
  "interface/cleaner/**/*.{ts,tsx}",
  "interface/translator/**/*.{ts,tsx}",
  "interface/app-router.tsx",
  "interface/App.tsx",
  "interface/main.tsx",
];

const DEFAULT_STRICT_DIRS = [
  "interface/ui/**/*.{ts,tsx}",
  "interface/lib/**/*.{ts,tsx}",
];

const BASE_IGNORES = [
  "node_modules/**",
  "**/dist/**",
  "**/dist-electron/**",
  "release-desktop/**",
  "coverage/**",
  "**/*.min.js",
];

/**
 * @param {object} options
 * @param {string[]} [options.appIgnores] app-specific ignored paths (e.g. src-tauri/target, mini-backend)
 * @param {string[]} [options.legacyFiles] large legacy files exempt from lint (removed progressively)
 * @param {string[]} [options.legacyDirs] legacy surface globs (hooks → warn). Default: subdirs of interface/
 * @param {string[]} [options.strictDirs] new surfaces under full strict. Default: interface/{ui,lib}
 * @param {string[]} [options.sourceGlobs] app TS/React source globs. Default: interface/ + tests/
 */
export function defineKomaEslintConfig({
  appIgnores = [],
  legacyFiles = [],
  legacyDirs = DEFAULT_LEGACY_DIRS,
  strictDirs = DEFAULT_STRICT_DIRS,
  sourceGlobs = ["interface/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
} = {}) {
  return [
    {
      ignores: [...BASE_IGNORES, ...appIgnores, ...legacyFiles],
    },

    js.configs.recommended,

    // App TS/React code
    {
      files: sourceGlobs,
      languageOptions: {
        parser: tsparser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          ecmaFeatures: { jsx: true },
        },
        globals: COMMON_GLOBALS,
      },
      plugins: {
        "@typescript-eslint": tseslint,
        "react-hooks": reactHooks,
        react: reactPlugin,
      },
      rules: {
        // ---- React Hooks discipline (CRITICAL) ----
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "error",

        // ---- React 18+ patterns ----
        "react/jsx-key": "error",
        "react/jsx-no-target-blank": ["error", { allowReferrer: false }],
        "react/no-deprecated": "error",
        "react/no-direct-mutation-state": "error",
        "react/no-unescaped-entities": "off",
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off", // TypeScript handles this

        // ---- TypeScript hygiene ----
        "@typescript-eslint/no-unused-vars": ["warn", {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        }],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/ban-ts-comment": ["warn", {
          "ts-ignore": "allow-with-description",
          "ts-expect-error": "allow-with-description",
        }],
        "no-unused-vars": "off", // delegated to TS rule above

        // ---- General hygiene ----
        "no-console": ["warn", { allow: ["warn", "error", "info"] }],
        "no-debugger": "error",
        "no-empty": ["error", { allowEmptyCatch: true }],
        "no-prototype-builtins": "off",
        "no-useless-escape": "warn",
        "no-undef": "off", // TS handles this
        "no-redeclare": "off", // delegated to TS
        "no-unreachable": "error",
        "prefer-const": "warn",
        eqeqeq: ["error", "smart"],
      },
      settings: {
        react: { version: "18" },
      },
    },

    // Legacy surfaces: hooks downgraded to warn (current baseline)
    {
      files: legacyDirs,
      rules: {
        "react-hooks/rules-of-hooks": "warn",
        "react-hooks/exhaustive-deps": "warn",
        "no-useless-assignment": "warn",
        "preserve-caught-error": "off",
      },
    },

    // New surfaces: full strict
    {
      files: strictDirs,
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "error",
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-unused-vars": ["error", {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        }],
        "no-console": ["error", { allow: ["warn", "error"] }],
      },
    },

    // Testes: relaxados (inclui fixtures .mjs com globals Node)
    {
      files: [
        "**/*.{test,spec}.{ts,tsx,mjs,js}",
        "tests/**/*.{ts,tsx,mjs,js}",
      ],
      languageOptions: {
        globals: NODE_GLOBALS,
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
        "no-undef": "off",
      },
    },

    // Scripts Node do app: globals Node + relaxados
    {
      files: ["scripts/**/*.{js,mjs,cjs,ts}"],
      languageOptions: {
        globals: NODE_GLOBALS,
      },
      rules: {
        "no-console": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        "no-control-regex": "off",
        "no-useless-assignment": "warn",
        "preserve-caught-error": "off",
      },
    },

    // Configs de root (vite/vitest/playwright): TS parser + globals Node
    {
      files: ["*.config.{ts,mts,cts}", "vite.config.{ts,mts}", "vitest.config.ts", "playwright.config.ts"],
      languageOptions: {
        parser: tsparser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
        },
        globals: NODE_GLOBALS,
      },
      plugins: {
        "@typescript-eslint": tseslint,
      },
      rules: {
        "no-console": "off",
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ];
}
