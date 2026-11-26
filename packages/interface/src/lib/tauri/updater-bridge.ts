import { listen } from "@tauri-apps/api/event";
import { desktopCommandChannels } from "@shared/desktop-api";
import type { IUpdaterBridge } from "@shared/desktop-api";
import type {
  UpdaterChannel,
  UpdaterEventPayload,
  UpdaterListener,
} from "@shared/desktop-events";
import {
  parseUpdaterEventPayload,
  parseUpdaterStatusPayload,
} from "@shared/desktop-events";

import { invokeCommand } from "./invoke";

const updaterListeners = new Set<UpdaterListener>();
let updaterEventsBound = false;

const bindUpdaterEvents = (): void => {
  if (updaterEventsBound) return;
  updaterEventsBound = true;
  listen<unknown>("updater:event", (event) => {
    const parsed: UpdaterEventPayload | null = parseUpdaterEventPayload(event.payload);
    if (!parsed) {
      console.warn("[tauri-updater] dropped malformed updater:event payload");
      return;
    }
    updaterListeners.forEach((listener) => {
      try {
        listener(parsed);
      } catch {
      }
    });
  }).catch((error: unknown) => {
    updaterEventsBound = false;
    console.warn("[tauri-updater] failed to bind updater events:", error);
  });
};

const assertTauriUpdaterChannel = (channel: UpdaterChannel): UpdaterChannel => {
  if (channel === "stable" || channel === "beta") {
    return channel;
  }
  throw new Error("Invalid update channel.");
};

export const tauriUpdaterBridge: IUpdaterBridge = {
  getState: async () =>
    parseUpdaterStatusPayload(
      await invokeCommand<unknown>(desktopCommandChannels.updater.getState),
    ),
  check: async (payload: { channel: UpdaterChannel }) =>
    parseUpdaterStatusPayload(
      await invokeCommand<unknown>(desktopCommandChannels.updater.check, {
        channel: assertTauriUpdaterChannel(payload.channel),
      }),
    ),
  download: async (payload: { channel: UpdaterChannel }) => {
    await invokeCommand<unknown>(desktopCommandChannels.updater.download, {
      channel: assertTauriUpdaterChannel(payload.channel),
    });
  },
  install: async () => {
    await invokeCommand<unknown>(desktopCommandChannels.updater.install);
  },
  setAutoInstall: async (payload: { enabled: boolean }) =>
    parseUpdaterStatusPayload(
      await invokeCommand<unknown>(desktopCommandChannels.updater.setAutoInstall, {
        enabled: Boolean(payload.enabled),
      }),
    ),
  ackUiReady: async () =>
    Boolean(await invokeCommand<boolean>(desktopCommandChannels.updater.ackUiReady)),
  on: (listener: UpdaterListener) => {
    bindUpdaterEvents();
    updaterListeners.add(listener);
    return () => {
      updaterListeners.delete(listener);
    };
  },
};
