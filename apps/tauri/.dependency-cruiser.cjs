// dependency-cruiser configuration for KŌMA Studio v2.
//
// Goals:
//   1. Block circular dependencies (HARD).
//   2. Block orphan source files in interface/ (HARD once Phase 2 lands).
//   3. Block interface/ from importing src-tauri/ source files directly
//      (must go through shared-models/ contracts or @tauri-apps/api).
//   4. Enforce clean-architecture cross-domain rules ONCE the
//      interface/domains/<x>/ tree exists (Phase 2 Wave 1+).
//   5. Warn on heavy v1 god-files importing each other (legacy debt).
//
// Rule severities:
//   error → blocks `bun run audit:deps`
//   warn  → reports but does not fail
//   info  → informational
//
// Phase 1 baseline: most rules are HARD on circular/orphan, with
// cross-domain enforcement targeting the new tree only. v1 legacy
// imports inside interface/components, interface/hooks, interface/pages
// remain warn-only until rewritten in Phase 2.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // -----------------------------------------------------------------
    // 1. Hard rules — apply everywhere
    // -----------------------------------------------------------------
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular dependencies via runtime imports are banned. Type-only cycles are tolerated because TypeScript erases them. Refactor real value cycles via inversion or an interface module.',
      from: {
        // Pre-existing v1 type-only cycles tolerated until Phase 2 rewrite.
        // dependency-cruiser cannot always tag `import type` as type-only on v5+ TS,
        // so we exempt the known-clean cycles here. Phase 2 extracts shared types.
        pathNot: [
          '^interface/i18n/(messages\\.ts|langs/.*\\.ts)$',
          '^interface/config/(api|features)\\.ts$',
          '^interface/contexts/AuthContext\\.tsx$',
          '^interface/utils/(renderText|renderModePresets|textFillPicker)\\.ts$',
          '^interface/typography/(renderStyle|textEffects)\\.ts$',
        ],
      },
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Orphan modules are usually dead code or accidentally unused. Phase 2 promotes this to error.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$', // dotfiles
          '\\.d\\.ts$',
          '(^|/)tsconfig.*\\.json$',
          '(^|/)scripts/',
          '(^|/)tests/',
          '(^|/)src-tauri/',
          '(^|/)mini-backend/',
          '(^|/)resources/',
          '(^|/)\\.husky/',
          '(^|/)docs/',
          '(^|/)i18n/langs/',
          'vite\\.config\\.ts$',
          'vitest\\.config\\.ts$',
          'playwright\\.config\\.ts$',
          'tailwind\\.config\\..*$',
          'interface/main\\.tsx$',
          'interface/App\\.tsx$',
          'interface/app-router\\.tsx$',
        ],
      },
      to: {},
    },
    {
      name: 'no-deprecated-core',
      severity: 'warn',
      comment:
        "Don't use legacy core Node modules; pick a current alternative.",
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: ['^(domain|punycode|sys|querystring)$'],
      },
    },

    // -----------------------------------------------------------------
    // 2. Architecture rules — Phase 1 baseline
    // -----------------------------------------------------------------
    {
      name: 'ui-must-not-import-rust-source',
      severity: 'error',
      comment:
        'interface/ must talk to Tauri only via @tauri-apps/api or the typed wrapper at interface/lib/tauri/. Direct imports from src-tauri/ source files are forbidden.',
      from: { path: '^interface/' },
      to: {
        path: '^src-tauri/(src|target|gen)/',
      },
    },
    {
      name: 'shared-models-must-not-import-ui',
      severity: 'error',
      comment:
        'shared-models/ is the typed contract layer. It must remain renderer-agnostic and free of UI imports.',
      from: { path: '^shared-models/' },
      to: { path: '^interface/' },
    },
    {
      name: 'shared-models-must-not-import-rust-source',
      severity: 'error',
      comment:
        'shared-models/ describes shared contracts. It must not depend on Rust source files.',
      from: { path: '^shared-models/' },
      to: { path: '^src-tauri/(src|target|gen)/' },
    },
    {
      name: 'no-test-imports-from-prod',
      severity: 'error',
      comment:
        'Production source files must not import from test or fixture files.',
      from: { pathNot: '\\.(test|spec|stories)\\.(ts|tsx)$' },
      to: { path: '\\.(test|spec|stories)\\.(ts|tsx)$' },
    },

    // -----------------------------------------------------------------
    // 3. Cross-domain rules — Phase 2 Wave 1+ (enforced once domains/ exists)
    // -----------------------------------------------------------------
    {
      name: 'domain-must-not-cross-import-domain-internals',
      severity: 'error',
      comment:
        'A domain may only import from sibling domains via their public barrel (interface/domains/<x>/index.ts), never from internals like stores/, services/, hooks/.',
      from: { path: '^interface/domains/([^/]+)/' },
      to: {
        path: '^interface/domains/([^/]+)/(stores|services|hooks)/',
        pathNot: [
          // allow self-imports inside the same domain
          '^interface/domains/$1/',
        ],
      },
    },
    {
      name: 'stores-must-not-import-react',
      severity: 'error',
      comment:
        'Zustand stores must remain pure state containers. No React or component imports.',
      from: { path: '^interface/(domains/[^/]+/stores|app/stores)/' },
      to: {
        path: [
          '^interface/components/',
          '^interface/pages/',
          '^interface/domains/[^/]+/components/',
          '^interface/ui/',
        ],
      },
    },
    {
      name: 'components-must-not-import-services-directly',
      severity: 'warn',
      comment:
        'Components should consume domain logic via hooks, not call services directly. Phase 2 promotes this to error after rewrite lands.',
      from: {
        path: '^interface/(components|pages|domains/[^/]+/(components|pages))/',
        pathNot: '(\\.(test|spec|stories)\\.(ts|tsx)$|/test-utils\\.tsx?$)',
      },
      to: { path: '^interface/domains/[^/]+/services/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: [
        '(^|/)node_modules/',
        '(^|/)dist/',
        '(^|/)release-desktop/',
        '(^|/)src-tauri/(target|gen)/',
        '(^|/)\\.venv-mini/',
        '(^|/)tests/e2e/(test-results|playwright-report|\\.artifacts)/',
        '(^|/)coverage/',
        '(^|/)mini-backend/dist/',
        '(^|/)mini-backend-hardened/',
        '\\.png$',
        '\\.webp$',
        '\\.mp4$',
        '\\.ico$',
        '\\.icns$',
        '\\.lock$',
        '\\.bspatch$',
        '\\.vcdiff$',
      ],
    },
    moduleSystems: ['es6', 'cjs', 'amd'],
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
      dot: {
        collapsePattern:
          '^(node_modules/[^/]+|^src-tauri/[^/]+|^interface/(components|pages|hooks|services|utils|domains/[^/]+))/',
        theme: {
          graph: { rankdir: 'LR' },
        },
      },
    },
  },
};
