# @koma/interface

Shared React UI consumed by both desktop shells (`apps/electron`, `apps/tauri`).
Every user-facing screen, hook, and feature lives here; the shells only wire up
the bridge (`@koma/interface/adapters/*`) before importing `@koma/interface/main`.

## Layout

```
packages/interface   ← this package: React app (pages, features, hooks…)
packages/ui          ← design system
packages/auth        ← auth client (RuntimeAdapter)
packages/types       ← shared contracts (desktop-api, desktop-events, workspace…)
apps/electron        ← Electron shell implementing the desktop-api contract
apps/tauri           ← Tauri shell implementing the desktop-api contract
```

## Shell entry point

```ts
// 1. Register the bridge provider for this shell before any UI import.
import { setElectronBridgeProvider } from "@koma/interface/adapters/electron-bridge";

// 2. Render the app (side-effect import — registers i18n, query client, etc.).
import "@koma/interface/main";
```

See `apps/electron/lib/register-electron-bridge.ts` and
`packages/interface/src/lib/tauri/register.ts` for the working examples.
