// RuntimeAdapter for @koma/auth — port injected by the app at bootstrap
// (apps/tauri wraps lib/tauri/api; apps/electron implements via window.desktop).
//
// Registration: setRuntimeAdapter(adapter) in main.tsx, before rendering.

import type {
  AuthConfigPayload,
  AuthLoginPayload,
  AuthRegisterPayload,
  AuthTravelTokenPayload,
  AuthTravelTokenRequest,
  DesktopApiEnvelope,
  DesktopAuthSessionSnapshot,
  JsonRecord,
} from "@koma/types/desktop-api";

export type { DesktopAuthSessionSnapshot };

/**
 * The renderer-facing desktop auth port. Typed end to end — both bridges
 * (electron preload, tauri commands) implement these exact envelopes:
 * - session()'s payload is null when no session exists (the electron bridge
 *   skips the fetch without an auth cookie — desktop-auth-ipc.ts).
 * - refreshSession() payloads carry at least { refreshed: boolean }; the
 *   tauri bridge adds tokenExpiresAt, electron adds sessionId — no renderer
 *   consumer reads either, so the port pins the common denominator.
 * - signOut() resolves void (the envelope, when the bridge emits one, is
 *   consumed inside the bridge).
 */
export interface DesktopAuthApiPort {
  config: () => Promise<DesktopApiEnvelope<AuthConfigPayload>>;
  session: () => Promise<DesktopApiEnvelope<DesktopAuthSessionSnapshot | null>>;
  refreshSession: () => Promise<DesktopApiEnvelope<{ refreshed: boolean }>>;
  login: (payload: AuthLoginPayload) => Promise<DesktopApiEnvelope<DesktopAuthSessionSnapshot>>;
  register: (payload: AuthRegisterPayload) => Promise<DesktopApiEnvelope<DesktopAuthSessionSnapshot>>;
  setTravelToken: (token: string) => Promise<DesktopApiEnvelope<JsonRecord>>;
  createTravelToken: (
    payload?: AuthTravelTokenRequest,
  ) => Promise<DesktopApiEnvelope<AuthTravelTokenPayload>>;
  verifyEmail: (accessToken: string) => Promise<DesktopApiEnvelope<JsonRecord>>;
  confirmEmail: (token: string) => Promise<DesktopApiEnvelope<JsonRecord>>;
  forgotPassword: (email: string) => Promise<DesktopApiEnvelope<JsonRecord>>;
  resetPassword: (token: string, password: string) => Promise<DesktopApiEnvelope<JsonRecord>>;
  signOut: () => Promise<void>;
}

export interface KomaRuntimeAdapter {
  /** true when running inside the desktop shell (Electron/Tauri) */
  isDesktopRuntime(): boolean;
  /** desktop auth bridge, or null in the browser */
  getDesktopAuthApi(): DesktopAuthApiPort | null;
  /** v1 offline mode: VITE_AUTH_DISABLED / runtimeConfig.authDisabled */
  isAuthDisabled(): boolean;
  /** builds an absolute API URL (auth/local) respecting the app runtime config */
  buildUrl(base: "authUrl" | "localUrl", routePath: string): string;
  /** desktop client update-policy headers (v2) */
  getDesktopUpdatePolicyHeaders(): Record<string, string>;
  /** hook: true while an update is blocking sessions */
  useUpdaterBlocking(): boolean;
}

let adapter: KomaRuntimeAdapter | null = null;

export const setRuntimeAdapter = (next: KomaRuntimeAdapter): void => {
  adapter = next;
};

export const getRuntimeAdapter = (): KomaRuntimeAdapter => {
  if (!adapter) {
    throw new Error(
      "@koma/auth: setRuntimeAdapter() was not called during app bootstrap",
    );
  }
  return adapter;
};
