# @koma/ui

Design system shared between `apps/electron` and `apps/tauri`. Consumed as
**raw TS/CSS source** (no build), same pattern as `@koma/types`.

## Contents

- `src/styles/tokens.css` — `:root` block (`--auth-*` + oklch shadcn) and `.dark`,
  extracted 1:1 from App.css. `@custom-variant dark` and the rest of the CSS
  stay in each app's App.css.
- `src/styles/{KomaModals.css, cursor.css, page-transition.css, NekoLogo.css}`
- `src/components/{popover,tooltip}.tsx` — Radix primitives
- `src/stores/theme-store.ts` — dark/light theme (zustand + persist)
- `src/utils/cn.ts` — `cn()`; apps keep `interface/lib/utils.ts` as a shim
  re-exporting from here
- `assets/` — auth media (login-background.mp4, logos, before/after) — same
  on both apps; bundled via vite import (not via resources/)

## Entry rule

A component/style only lands here when it is **identical** across both apps
(or after a dedicated unification PR adopting the v2 version). Typography
was deliberately kept out: `presets.ts` depends on `utils/renderModePresets`
→ `renderText`, which lives in `packages/interface/`.

## Note on @types/react

Apps pin react types via tsconfig `paths` (`"react": ["./node_modules/@types/react"]`)
because bun hoists the store deps and resolves `@types/react` upward to the
repo root, which hosts version 19 (needed by the landing). Without the pin,
mixed versions break typecheck.
