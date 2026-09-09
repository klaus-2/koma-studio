/**
 * Integrations module - Discord RPC, Blogger, Imgur.
 * Extracted from electron/main.ts during God File decomposition.
 */
import {
  loadDesktopBloggerConfig,
  publishDesktopBloggerPost,
  saveDesktopBloggerConfig,
  testDesktopBloggerConnection,
  uploadDesktopBloggerImages,
} from "../blogger.ts";
import {
  loadDesktopImgurConfig,
  saveDesktopImgurConfig,
  uploadDesktopImgurImages,
} from "../imgur.ts";
import { discordRPC } from "../discord-rpc.ts";
import {
  toStringValue,
  toNumberValue,
  registerIpcHandler,
  registerSecureIpcHandler,
} from "./shared.ts";

// ---------------------------------------------------------------------------
// Discord RPC IPC handlers
// ---------------------------------------------------------------------------

const setupDiscordIpcHandlers = (): void => {
  registerIpcHandler("discord-rpc:set-enabled", async (value) => {
    return discordRPC.setEnabled(Boolean(value));
  });

  registerIpcHandler("discord-rpc:set-activity", async (value) => {
    await discordRPC.setActivity((value ?? {}) as any);
  });

  registerIpcHandler("discord-rpc:set-preset", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    await discordRPC.setPresetActivity(
      toStringValue(payload.preset) as any,
      ((payload.overrides ?? {}) as Record<string, unknown>) as any,
    );
  });

  registerIpcHandler("discord-rpc:set-cleaning", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    await discordRPC.setCleaningActivity(
      toStringValue(payload.fileName),
      toStringValue(payload.mode),
    );
  });

  registerIpcHandler("discord-rpc:set-translating", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    await discordRPC.setTranslatingActivity(
      toStringValue(payload.fileName),
      toStringValue(payload.from),
      toStringValue(payload.to),
    );
  });

  registerIpcHandler("discord-rpc:set-typing", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    await discordRPC.setTypingActivity(toStringValue(payload.fileName));
  });

  registerIpcHandler("discord-rpc:set-redrawing", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    await discordRPC.setRedrawingActivity(toStringValue(payload.fileName));
  });

  registerIpcHandler("discord-rpc:set-dashboard", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    await discordRPC.setDashboardActivity(
      toStringValue(payload.userName),
    );
  });

  registerIpcHandler("discord-rpc:set-batch", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    await discordRPC.setBatchProcessingActivity(
      toNumberValue(payload.fileCount),
      toNumberValue(payload.currentIndex),
      toStringValue(payload.fileName),
    );
  });

  registerIpcHandler("discord-rpc:set-idle", async () => {
    await discordRPC.setIdleActivity();
  });

  registerIpcHandler("discord-rpc:is-connected", async () => {
    return discordRPC.isConnected();
  });

  registerIpcHandler("discord-rpc:is-enabled", async () => {
    return discordRPC.isEnabled();
  });

  registerIpcHandler("discord-rpc:get-preset-assets", async () => {
    return discordRPC.getPresetAssetMap();
  });
};

// ---------------------------------------------------------------------------
// Blogger IPC handlers
// ---------------------------------------------------------------------------

const setupDesktopBloggerIpcHandlers = (): void => {
  registerSecureIpcHandler("desktop-api:blogger:config:load", async () => {
    return loadDesktopBloggerConfig();
  });

  registerSecureIpcHandler("desktop-api:blogger:config:save", async (value) => {
    return saveDesktopBloggerConfig(value);
  });

  registerSecureIpcHandler("desktop-api:blogger:test-connection", async (value) => {
    return testDesktopBloggerConnection(value);
  });

  registerSecureIpcHandler("desktop-api:blogger:upload-images", async (value) => {
    return uploadDesktopBloggerImages((value ?? {}) as any);
  });

  registerSecureIpcHandler("desktop-api:blogger:publish-post", async (value) => {
    return publishDesktopBloggerPost((value ?? {}) as any);
  });
};

// ---------------------------------------------------------------------------
// Imgur IPC handlers
// ---------------------------------------------------------------------------

const setupDesktopImgurIpcHandlers = (): void => {
  registerSecureIpcHandler("desktop-api:imgur:config:load", async () => {
    return loadDesktopImgurConfig();
  });

  registerSecureIpcHandler("desktop-api:imgur:config:save", async (value) => {
    return saveDesktopImgurConfig(value);
  });

  registerSecureIpcHandler("desktop-api:imgur:upload-images", async (value) => {
    return uploadDesktopImgurImages((value ?? {}) as any);
  });
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  setupDiscordIpcHandlers,
  setupDesktopBloggerIpcHandlers,
  setupDesktopImgurIpcHandlers,
};
