# @koma/auth

Shared auth client consumed by `apps/electron` and `apps/tauri`. Implements:

- `src/contexts/AuthContext.tsx` — React context with the shared `useAuth` /
  `useSession` / `useQueryAuth` hooks.
- `src/runtime-adapter.ts` — runtime adapter that lets each shell (Electron,
  Tauri, browser preview) plug its own desktop-bridge implementation.
- `src/query/authConfig.ts` — Turnstile site-key / captcha-bypass configuration.
- `src/utils/passwordPolicy.ts` — server- and client-side policy shared with
  `apps/auth-server`.

## Runtime adapter contract

Each shell must call `setRuntimeAdapter(...)` BEFORE mounting the React tree
(do it in the shell-specific bootstrap module: `apps/electron/lib/register-electron-bridge.ts`
or `packages/interface/src/lib/tauri/register.ts`). The package fails fast if the
adapter is missing at mount time, so dev previews and unit tests get a
loud error rather than silent fallbacks.

See `apps/auth-server/README.md` for the server contract and the root README
for the full monorepo map.
