import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { IDiscordRpcBridge } from "../types";

export const DISCORD_RPC_STORAGE_KEY = "discord-rpc-enabled";
const CONNECTION_POLL_INTERVAL_MS = 15_000;

interface DiscordRpcStoreState {
  enabled: boolean;
  isConnected: boolean;
  presetAssets: Record<string, string>;
  setEnabledState: (enabled: boolean) => void;
  setConnected: (connected: boolean) => void;
  setPresetAssets: (assets: Record<string, string>) => void;
}

const readInitialEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return window.localStorage.getItem(DISCORD_RPC_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};

export const useDiscordRpcStore = create<DiscordRpcStoreState>()(
  devtools(
    (set) => ({
      enabled: readInitialEnabled(),
      isConnected: false,
      presetAssets: {},
      setEnabledState: (enabled) => set({ enabled }),
      setConnected: (isConnected) => set({ isConnected }),
      setPresetAssets: (presetAssets) => set({ presetAssets }),
    }),
    { name: "discord-rpc-store", enabled: import.meta.env.DEV },
  ),
);

let activeBridge: IDiscordRpcBridge | null = null;
let subscriberCount = 0;
let pollTimer: number | null = null;
let lastSyncedEnabled: boolean | null = null;
let assetsLoadedForBridge: IDiscordRpcBridge | null = null;

export async function refreshDiscordRpcConnection(
  bridge: IDiscordRpcBridge | null,
): Promise<boolean> {
  if (!bridge) {
    useDiscordRpcStore.getState().setConnected(false);
    return false;
  }
  try {
    const connected = await bridge.isConnected();
    useDiscordRpcStore.getState().setConnected(connected);
    return connected;
  } catch {
    useDiscordRpcStore.getState().setConnected(false);
    return false;
  }
}

export async function syncDiscordRpcEnabled(
  bridge: IDiscordRpcBridge | null,
  enabled: boolean,
): Promise<boolean> {
  useDiscordRpcStore.getState().setEnabledState(enabled);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DISCORD_RPC_STORAGE_KEY, String(enabled));
    } catch {
    }
  }
  if (!bridge) {
    useDiscordRpcStore.getState().setConnected(false);
    return false;
  }
  lastSyncedEnabled = enabled;
  try {
    const connected = await bridge.setEnabled(enabled);
    useDiscordRpcStore.getState().setConnected(connected);
    return connected;
  } catch {
    useDiscordRpcStore.getState().setConnected(false);
    return false;
  }
}

async function ensureBridgeBootstrap(bridge: IDiscordRpcBridge): Promise<void> {
  const { enabled } = useDiscordRpcStore.getState();
  if (lastSyncedEnabled !== enabled) {
    await syncDiscordRpcEnabled(bridge, enabled);
  } else {
    await refreshDiscordRpcConnection(bridge);
  }

  if (assetsLoadedForBridge !== bridge) {
    assetsLoadedForBridge = bridge;
    try {
      const assets = await bridge.getPresetAssets();
      useDiscordRpcStore.getState().setPresetAssets(assets);
    } catch {
      assetsLoadedForBridge = null;
    }
  }
}

export function acquireDiscordRpcLifecycle(
  bridge: IDiscordRpcBridge | null,
): () => void {
  if (!bridge) {
    return () => undefined;
  }

  if (activeBridge !== bridge) {
    activeBridge = bridge;
    lastSyncedEnabled = null;
    assetsLoadedForBridge = null;
  }

  subscriberCount += 1;
  if (subscriberCount === 1) {
    void ensureBridgeBootstrap(bridge);
    pollTimer = window.setInterval(() => {
      void refreshDiscordRpcConnection(bridge);
    }, CONNECTION_POLL_INTERVAL_MS);
  }

  return () => {
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0 && pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}
