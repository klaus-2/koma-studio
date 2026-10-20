// dependency-cruiser rules for @koma/ui + @koma/interface packages.
// Stores stay React-free, UI does not import shell/Rust source, and
// cross-domain internals are not reached across package seams.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      // warn until the known type/runtime cycles in packages/interface are paid down
      // (34 pre-existing violations as of the token-catalog landing). New rules stay error.
      severity: 'warn',
      comment: 'Runtime import cycles are banned. Currently warn-only due to legacy cycles.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'stores-must-not-import-react-ui',
      severity: 'error',
      comment:
        'Zustand stores must remain pure state containers — no React component modules (.tsx). Shared types/utils under components/ are allowed.',
      from: { path: '(^|/)(packages/(ui|interface)/src/)?stores/' },
      to: {
        path: ['\\.tsx$'],
        pathNot: ['\\.(test|spec)\\.(ts|tsx)$'],
      },
    },
    {
      name: 'ui-must-not-import-shell-or-rust-source',
      severity: 'error',
      comment:
        '@koma/ui and packages/interface talk to shells only via contracts (@koma/types, desktop bridge). Direct src-tauri / electron main imports are forbidden.',
      from: { path: '^packages/(ui|interface)/' },
      to: {
        path: [
          'src-tauri/(src|target|gen)/',
          'electron/(main|preload|modules)/',
          'apps/(tauri|electron)/src-tauri/',
        ],
      },
    },
    {
      name: 'types-must-not-import-ui',
      severity: 'error',
      comment: '@koma/types stays renderer-agnostic.',
      from: { path: '^packages/types/' },
      to: { path: '^packages/(ui|interface)/' },
    },
    {
      name: 'no-test-imports-from-prod',
      severity: 'error',
      comment: 'Production sources must not import tests or fixtures.',
      from: { pathNot: '\\.(test|spec|stories)\\.(ts|tsx)$' },
      to: { path: '\\.(test|spec|stories)\\.(ts|tsx)$' },
    },
    {
      name: 'tokens-must-not-import-react',
      severity: 'error',
      comment: 'Token catalog is pure data.',
      from: { path: 'packages/ui/src/tokens/' },
      to: { path: '^(react|react-dom|@?react-|packages/ui/src/components/)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        '(^|/)node_modules/',
        '(^|/)dist/',
        '(^|/)target/',
        '(^|/)\\.venv',
        '(^|/)coverage/',
        '\\.(css|svg|png|webp|json)$',
      ],
    },
    tsPreCompilationDeps: true,
  },
};
