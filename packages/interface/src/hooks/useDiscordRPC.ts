import { useCallback, useEffect, useMemo, useState } from "react";

import type { AuthUser } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import type {
  DiscordActivityPreset,
  DiscordProcessingMode,
  IDiscordRpcBridge,
} from "../types";

import { desktopBridge } from "@/lib/desktop-bridge";
const DISCORD_RPC_STORAGE_KEY = "discord-rpc-enabled";
const CONNECTION_POLL_INTERVAL_MS = 15_000;
const DISCORD_MODE_LABEL_KEYS = {
  organize: "dashboard.mode.organize",
  aio: "dashboard.mode.aio",
  cleaner: "dashboard.mode.cleaner",
  typesetter: "dashboard.mode.typesetter",
  translator: "dashboard.mode.translator",
  raw: "dashboard.mode.raw",
  proofreader: "dashboard.mode.proofreader",
  stitch: "dashboard.mode.stitch",
  split: "dashboard.mode.split",
  watermark: "dashboard.mode.watermark",
  enhance: "dashboard.mode.enhance",
  optimizer: "dashboard.mode.optimizer",
  blogger: "dashboard.mode.blogger",
  imgur: "dashboard.mode.imgur",
  guides: "dashboard.mode.guides",
  resources: "dashboard.mode.resources",
} as const;

type DiscordDashboardUser = Pick<AuthUser, "name" | "email"> | null;
type DiscordModeLabel = keyof typeof DISCORD_MODE_LABEL_KEYS;
type TranslateFn = ReturnType<typeof useI18n>["t"];

const getDiscordModeLabels = (t: TranslateFn): Record<DiscordModeLabel, string> => {
  const entries = Object.entries(DISCORD_MODE_LABEL_KEYS).map(([mode, key]) => [mode, t(key)] as const);
  return Object.fromEntries(entries) as Record<DiscordModeLabel, string>;
};

const toDashboardName = (user: DiscordDashboardUser, fallbackLabel: string): string => {
  const displayName = user?.name?.trim();
  if (displayName) {
    return displayName;
  }

  if (!user?.email) {
    return fallbackLabel;
  }

  const [name] = user.email.split("@");
  return name || fallbackLabel;
};

const runSilently = async (callback: () => Promise<void>): Promise<void> => {
  try {
    await callback();
  } catch {
    // Discord RPC failure must never break app flow
  }
};

export interface DiscordRpcController {
  enabled: boolean;
  isConnected: boolean;
  isAvailable: boolean;
  presetAssets: Record<string, string>;
  toggleRPC: (enabled: boolean) => Promise<void>;
  refreshConnection: () => Promise<boolean>;
  setPreset: (
    preset: DiscordActivityPreset,
    overrides?: Record<string, unknown>,
  ) => Promise<void>;
  setCleaning: (fileName: string, mode: DiscordProcessingMode) => Promise<void>;
  setTranslating: (fileName: string, from: string, to: string) => Promise<void>;
  setTyping: (fileName: string) => Promise<void>;
  setRedrawing: (fileName: string) => Promise<void>;
  setBatch: (fileCount: number, currentIndex: number, fileName?: string) => Promise<void>;
  setDashboard: () => Promise<void>;
  setIdle: () => Promise<void>;
}

export const useDiscordRPC = (user: DiscordDashboardUser): DiscordRpcController => {
  const { t } = useI18n();
  const bridge = useMemo<IDiscordRpcBridge | null>(() => desktopBridge.desktop?.discordRPC ?? null, []);
  const [enabled, setEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(DISCORD_RPC_STORAGE_KEY);
    return saved !== "false";
  });
  const [isConnected, setIsConnected] = useState(false);
  const [presetAssets, setPresetAssets] = useState<Record<string, string>>({});
  const modeLabels = useMemo(() => getDiscordModeLabels(t), [t]);
  const routePresetLabels = useMemo(
    () => ({
      settings: t("discord.presence.settings.label" as any),
      rankings: t("discord.presence.rankings.label" as any),
      scanlationFeed: t("discord.presence.scanlationFeed.label" as any),
      loginRegister: t("discord.presence.loginRegister.label" as any),
    }),
    [t],
  );
  const refreshConnection = useCallback(async (): Promise<boolean> => {
    if (!bridge) {
      setIsConnected(false);
      return false;
    }

    try {
      const connected = await bridge.isConnected();
      setIsConnected(connected);
      return connected;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    void refreshConnection();

    const interval = window.setInterval(() => {
      void refreshConnection();
    }, CONNECTION_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [bridge, refreshConnection]);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    const syncToggle = async () => {
      const connected = await bridge.setEnabled(enabled);
      setIsConnected(connected);
    };

    void runSilently(syncToggle);
  }, [bridge, enabled]);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    void runSilently(async () => {
      const assets = await bridge.getPresetAssets();
      setPresetAssets(assets);
    });
  }, [bridge]);

  const toggleRPC = useCallback(
    async (nextValue: boolean): Promise<void> => {
      setEnabled(nextValue);
      localStorage.setItem(DISCORD_RPC_STORAGE_KEY, String(nextValue));
    },
    [],
  );

  const callWhenEnabled = useCallback(
    async (callback: (rpc: IDiscordRpcBridge) => Promise<void>): Promise<void> => {
      if (!bridge || !enabled) {
        return;
      }

      await runSilently(async () => {
        await callback(bridge);
      });
    },
    [bridge, enabled],
  );

  const buildPresetOverrides = useCallback(
    (preset: DiscordActivityPreset, overrides: Record<string, unknown> = {}): Record<string, unknown> => {
      const appName = t("discord.presence.appName" as any);

      const defaults: Record<DiscordActivityPreset, Record<string, unknown>> = {
        idle: {
          details: t("discord.presence.idle.details" as any),
          state: t("discord.presence.idle.state" as any),
          largeImageText: appName,
          smallImageText: t("discord.presence.idle.state" as any),
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        workspace_organize_mode: {
          details: t("discord.presence.workspace.details" as any),
          state: modeLabels.organize,
          largeImageText: appName,
          smallImageText: modeLabels.organize,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        aio_pipeline_automatic: {
          details: t("discord.presence.aio.details" as any),
          state: t("discord.presence.mode.automatic" as any),
          largeImageText: appName,
          smallImageText: t("discord.presence.mode.automatic" as any),
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        aio_pipeline_manual: {
          details: t("discord.presence.aio.details" as any),
          state: t("discord.presence.mode.manual" as any),
          largeImageText: appName,
          smallImageText: t("discord.presence.mode.manual" as any),
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        translator_mode: {
          details: t("discord.presence.translator.details" as any),
          state: modeLabels.translator,
          largeImageText: appName,
          smallImageText: modeLabels.translator,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        typesetter_mode: {
          details: t("discord.presence.typesetter.details" as any),
          state: modeLabels.typesetter,
          largeImageText: appName,
          smallImageText: modeLabels.typesetter,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        cleaner_redraw_mode: {
          details: t("discord.presence.cleaner.details" as any),
          state: modeLabels.cleaner,
          largeImageText: appName,
          smallImageText: modeLabels.cleaner,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        raw_provider_mode: {
          details: t("discord.presence.raw.details" as any),
          state: modeLabels.raw,
          largeImageText: appName,
          smallImageText: modeLabels.raw,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        proofreader_qc_mode: {
          details: t("discord.presence.proofreader.details" as any),
          state: modeLabels.proofreader,
          largeImageText: appName,
          smallImageText: modeLabels.proofreader,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        stitcher_mode: {
          details: t("discord.presence.stitch.details" as any),
          state: modeLabels.stitch,
          largeImageText: appName,
          smallImageText: modeLabels.stitch,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        splitter_mode: {
          details: t("discord.presence.split.details" as any),
          state: modeLabels.split,
          largeImageText: appName,
          smallImageText: modeLabels.split,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        watermark_mode: {
          details: t("discord.presence.watermark.details" as any),
          state: modeLabels.watermark,
          largeImageText: appName,
          smallImageText: modeLabels.watermark,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        enhance_mode: {
          details: t("discord.presence.enhance.details" as any),
          state: modeLabels.enhance,
          largeImageText: appName,
          smallImageText: modeLabels.enhance,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        chapter_optimizer_mode: {
          details: t("discord.presence.optimizer.details" as any),
          state: modeLabels.optimizer,
          largeImageText: appName,
          smallImageText: modeLabels.optimizer,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        blogger_cdn_mode: {
          details: t("discord.presence.blogger.details" as any),
          state: modeLabels.blogger,
          largeImageText: appName,
          smallImageText: modeLabels.blogger,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        image_upload_mode: {
          details: t("discord.presence.imgur.details" as any),
          state: modeLabels.imgur,
          largeImageText: appName,
          smallImageText: modeLabels.imgur,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        guides_tutorials: {
          details: t("discord.presence.guides.details" as any),
          state: modeLabels.guides,
          largeImageText: appName,
          smallImageText: modeLabels.guides,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        resources_materials: {
          details: t("discord.presence.resources.details" as any),
          state: modeLabels.resources,
          largeImageText: appName,
          smallImageText: modeLabels.resources,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        settings: {
          details: t("discord.presence.settings.details" as any),
          state: routePresetLabels.settings,
          largeImageText: appName,
          smallImageText: routePresetLabels.settings,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        rankings: {
          details: t("discord.presence.rankings.details" as any),
          state: routePresetLabels.rankings,
          largeImageText: appName,
          smallImageText: routePresetLabels.rankings,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        scanlation_feed: {
          details: t("discord.presence.scanlationFeed.details" as any),
          state: routePresetLabels.scanlationFeed,
          largeImageText: appName,
          smallImageText: routePresetLabels.scanlationFeed,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        login_register: {
          details: t("discord.presence.loginRegister.details" as any),
          state: routePresetLabels.loginRegister,
          largeImageText: appName,
          smallImageText: routePresetLabels.loginRegister,
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
        batch_mode: {
          details: t("discord.presence.batch.details" as any),
          state: t("discord.presence.batch.state" as any, { current: 1, total: 1 }),
          largeImageText: appName,
          smallImageText: t("discord.presence.batch.label" as any),
          buttons: [
            { label: t("discord.presence.button.website" as any), url: "https://koma-studio.site" },
            { label: t("discord.presence.button.download" as any), url: "https://koma-studio.site/download/windows" },
          ],
        },
      };

      return {
        ...defaults[preset],
        ...overrides,
      };
    },
    [modeLabels, routePresetLabels, t],
  );

  const setPreset = useCallback(
    async (
      preset: DiscordActivityPreset,
      overrides?: Record<string, unknown>,
    ): Promise<void> => {
      await callWhenEnabled((rpc) => rpc.setPreset(preset, buildPresetOverrides(preset, overrides)));
    },
    [buildPresetOverrides, callWhenEnabled],
  );

  const setDashboard = useCallback(async (): Promise<void> => {
    if (user) {
      await setPreset("workspace_organize_mode", {
        details: t("discord.presence.workspace.details" as any),
        state: toDashboardName(user, t("dashboard.user.defaultName" as any)),
      });
      return;
    }
    await setPreset("idle", {
      details: t("discord.presence.idle.details" as any),
      state: t("discord.presence.idle.state" as any),
    });
  }, [setPreset, t, user]);

  const setCleaning = useCallback(
    async (_fileName: string, mode: DiscordProcessingMode): Promise<void> => {
      await setPreset("cleaner_redraw_mode", {
      details: t("discord.presence.cleaner.details" as any),
      state: t(`discord.presence.cleaner.state.${mode === "advanced" ? "advanced" : "basic"}` as any),
    });
    },
    [setPreset, t],
  );

  const setTranslating = useCallback(
    async (fileName: string, from: string, to: string): Promise<void> => {
      await setPreset("translator_mode", {
        details: t("discord.presence.translator.fileDetails" as any, { fileName }),
        state: `${from} -> ${to}`,
      });
    },
    [setPreset, t],
  );

  const setTyping = useCallback(
    async (fileName: string): Promise<void> => {
      await setPreset("typesetter_mode", {
        details: t("discord.presence.typesetter.fileDetails" as any, { fileName }),
        state: modeLabels.typesetter,
      });
    },
    [modeLabels.typesetter, setPreset, t],
  );

  const setRedrawing = useCallback(
    async (fileName: string): Promise<void> => {
      await setPreset("cleaner_redraw_mode", {
        details: t("discord.presence.redraw.fileDetails" as any, { fileName }),
        state: modeLabels.cleaner,
      });
    },
    [modeLabels.cleaner, setPreset, t],
  );

  const setBatch = useCallback(
    async (fileCount: number, currentIndex: number, fileName?: string): Promise<void> => {
      await setPreset("batch_mode", {
        details: fileName
          ? t("discord.presence.batch.fileDetails" as any, { fileName })
          : t("discord.presence.batch.details" as any),
        state: t("discord.presence.batch.state" as any, {
          current: currentIndex,
          total: fileCount,
        }),
      });
    },
    [setPreset, t],
  );

  const setIdle = useCallback(async (): Promise<void> => {
      await setPreset("idle", {
        details: t("discord.presence.idle.details" as any),
        state: t("discord.presence.idle.state" as any),
      });
  }, [setPreset, t]);

  return useMemo(
    () => ({
      enabled,
      isConnected,
      isAvailable: Boolean(bridge),
      presetAssets,
      toggleRPC,
      refreshConnection,
      setPreset,
      setCleaning,
      setTranslating,
      setTyping,
      setRedrawing,
      setBatch,
      setDashboard,
      setIdle,
    }),
    [
      bridge,
      enabled,
      isConnected,
      presetAssets,
      refreshConnection,
      setPreset,
      setBatch,
      setCleaning,
      setDashboard,
      setIdle,
      setRedrawing,
      setTranslating,
      setTyping,
      toggleRPC,
    ],
  );
};
