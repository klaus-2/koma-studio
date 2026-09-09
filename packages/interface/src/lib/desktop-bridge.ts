// Runtime-neutral port of the desktop bridge for @koma/interface.
//
// The shell (electron or tauri) registers the implementation BEFORE the first
// render: setDesktopBridgeProvider(provider). The interface code only consumes
// the `desktopBridge` object — never imports from @tauri-apps or window.desktop.
//
// Shape mirrors the existing test hook
// (setTauriApiBridgeOverridesForTests).

import type {
  IDesktopBridge,
  IUpdaterBridge,
  RuntimeConfig,
} from "@shared/desktop-api";
import type {
  DesktopEventName,
  DesktopEventPayloadMap,
} from "@shared/desktop-events";

export interface DesktopBridgeProvider {
  desktop: IDesktopBridge | null;
  updater: IUpdaterBridge | null;
  isDesktopRuntime(): boolean;
  getRuntimeConfig(): RuntimeConfig;
  hydrateRuntimeConfig(): Promise<RuntimeConfig>;
  /** Deep link: launch URL (cold start) or null. Tauri: plugin-deep-link. */
  getLaunchUrl?(): Promise<string | null>;
  /** Deep link: warm start — returns an unsubscribe. Electron: no-op for now. */
  onOpenUrl?(listener: (urls: string[]) => void): () => void;
  /** Low-level: raw invoke/listen (used by tests and rare cases). */
  invokeCommand?<TResponse = unknown>(
    channel: string,
    args?: Record<string, unknown> | undefined,
  ): Promise<TResponse>;
  listenToDesktopEvent?<TName extends DesktopEventName>(
    name: TName,
    listener: (payload: DesktopEventPayloadMap[TName]) => void,
  ): () => void;
}

let provider: Partial<DesktopBridgeProvider> | null = null;

/** Aceita provider completo, parcial (testes) ou null (reset). */
export const setDesktopBridgeProvider = (
  next: Partial<DesktopBridgeProvider> | null,
): void => {
  provider = next;
};

export const getDesktopBridgeProvider = (): Partial<DesktopBridgeProvider> => {
  if (!provider) {
    throw new Error(
      "@koma/interface: setDesktopBridgeProvider() was not called by the shell before render",
    );
  }
  return provider;
};

/** Facade consumed by the entire interface (e.g. the desktopBridge object). */
export const desktopBridge = {
  get desktop(): IDesktopBridge | null {
    return getDesktopBridgeProvider().desktop ?? null;
  },
  get updater(): IUpdaterBridge | null {
    return getDesktopBridgeProvider().updater ?? null;
  },
  isDesktopRuntime: (): boolean => getDesktopBridgeProvider().isDesktopRuntime?.() ?? false,
  getRuntimeConfig: (): RuntimeConfig => getDesktopBridgeProvider().getRuntimeConfig?.() ?? ({} as RuntimeConfig),
  hydrateRuntimeConfig: (): Promise<RuntimeConfig> =>
    getDesktopBridgeProvider().hydrateRuntimeConfig?.() ?? Promise.resolve({} as RuntimeConfig),
  getLaunchUrl: (): Promise<string | null> =>
    getDesktopBridgeProvider().getLaunchUrl?.() ?? Promise.resolve(null),
  onOpenUrl: (listener: (urls: string[]) => void): (() => void) | null =>
    getDesktopBridgeProvider().onOpenUrl?.(listener) ?? null,
  invokeCommand: <TResponse = unknown>(
    channel: string,
    args?: Record<string, unknown>,
  ): Promise<TResponse> =>
    getDesktopBridgeProvider().invokeCommand?.(channel, args) ??
    Promise.reject(new Error("provider does not support invokeCommand")),
  listenToDesktopEvent: <TName extends DesktopEventName>(
    name: TName,
    listener: (payload: DesktopEventPayloadMap[TName]) => void,
  ): Promise<() => void> | (() => void) => {
    const listen = getDesktopBridgeProvider().listenToDesktopEvent;
    if (!listen) return () => {};
    return listen(name, listener);
  },
};
