// RuntimeAdapter for @koma/auth — port injected by the app at bootstrap
// (apps/tauri wraps lib/tauri/api; apps/electron implements via window.desktop).
//
// Registration: setRuntimeAdapter(adapter) in main.tsx, before rendering.

export interface DesktopAuthApiPort {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  login: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  forgotPassword: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resetPassword: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signOut: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verifyEmail: (...args: any[]) => Promise<any>;
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
