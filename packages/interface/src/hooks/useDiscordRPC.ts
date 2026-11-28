import { useCallback, useEffect, useMemo } from "react";

import type { AuthUser } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import type {
  DiscordActivityPreset,
  DiscordProcessingMode,
  IDiscordRpcBridge,
} from "../types";
import {
  acquireDiscordRpcLifecycle,
  refreshDiscordRpcConnection,
  syncDiscordRpcEnabled,
  useDiscordRpcStore,
} from "../stores/discord-rpc-store";

import { desktopBridge } from "@/lib/desktop-bridge";

type DiscordDashboardUser = Pick<AuthUser, "name" | "email"> | null;
type TranslateFn = ReturnType<typeof useI18n>["t"];

const getDiscordModeLabels = (t: TranslateFn) => ({
  aio: t("dashboard.mode.aio"),
  cleaner: t("dashboard.mode.cleaner"),
  typesetter: t("dashboard.mode.typesetter"),
  translator: t("dashboard.mode.translator"),
  raw: t("dashboard.mode.raw"),
  proofreader: t("dashboard.mode.proofreader"),
  stitch: t("dashboard.mode.stitch"),
  split: t("dashboard.mode.split"),
  watermark: t("dashboard.mode.watermark"),
  enhance: t("dashboard.mode.enhance"),
  optimizer: t("dashboard.mode.optimizer"),
  blogger: t("dashboard.mode.blogger"),
  imgur: t("dashboard.mode.imgur"),
  guides: t("dashboard.mode.guides"),
  resources: t("dashboard.mode.resources"),
});

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
  const bridge = useMemo<IDiscordRpcBridge | null>(
    () => desktopBridge.desktop?.discordRPC ?? null,
    [],
  );
  const enabled = useDiscordRpcStore((s) => s.enabled);
  const isConnected = useDiscordRpcStore((s) => s.isConnected);
  const presetAssets = useDiscordRpcStore((s) => s.presetAssets);
  const modeLabels = useMemo(() => getDiscordModeLabels(t), [t]);
  const routePresetLabels = useMemo(
    () => ({
      settings: t("discord.presence.settings.label"),
      rankings: t("discord.presence.rankings.label"),
      scanlationFeed: t("discord.presence.scanlationFeed.label"),
      loginRegister: t("discord.presence.loginRegister.label"),
    }),
    [t],
  );

  useEffect(() => acquireDiscordRpcLifecycle(bridge), [bridge]);

  const refreshConnection = useCallback(
    () => refreshDiscordRpcConnection(bridge),
    [bridge],
  );

  const toggleRPC = useCallback(
    async (nextValue: boolean): Promise<void> => {
      await runSilently(async () => {
        await syncDiscordRpcEnabled(bridge, nextValue);
      });
    },
    [bridge],
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
    (
      preset: DiscordActivityPreset,
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> => {
      const appName = t("discord.presence.appName");
      const defaultButtons = [
        { label: t("discord.presence.button.website"), url: "https://koma-studio.site" },
        { label: t("discord.presence.button.download"), url: "https://koma-studio.site/download/windows" },
      ];

      const defaults: Record<DiscordActivityPreset, Record<string, unknown>> = {
        idle: {
          details: t("discord.presence.idle.details"),
          state: t("discord.presence.idle.state"),
          largeImageText: appName,
          smallImageText: t("discord.presence.idle.state"),
          buttons: defaultButtons,
        },
        workspace_idle: {
          details: t("discord.presence.workspace.details"),
          state: appName,
          largeImageText: appName,
          smallImageText: appName,
          buttons: defaultButtons,
        },
        aio_pipeline_automatic: {
          details: t("discord.presence.aio.details"),
          state: t("discord.presence.mode.automatic"),
          largeImageText: appName,
          smallImageText: t("discord.presence.mode.automatic"),
          buttons: defaultButtons,
        },
        aio_pipeline_manual: {
          details: t("discord.presence.aio.details"),
          state: t("discord.presence.mode.manual"),
          largeImageText: appName,
          smallImageText: t("discord.presence.mode.manual"),
          buttons: defaultButtons,
        },
        translator_mode: {
          details: t("discord.presence.translator.details"),
          state: modeLabels.translator,
          largeImageText: appName,
          smallImageText: modeLabels.translator,
          buttons: defaultButtons,
        },
        typesetter_mode: {
          details: t("discord.presence.typesetter.details"),
          state: modeLabels.typesetter,
          largeImageText: appName,
          smallImageText: modeLabels.typesetter,
          buttons: defaultButtons,
        },
        cleaner_redraw_mode: {
          details: t("discord.presence.cleaner.details"),
          state: modeLabels.cleaner,
          largeImageText: appName,
          smallImageText: modeLabels.cleaner,
          buttons: defaultButtons,
        },
        raw_provider_mode: {
          details: t("discord.presence.raw.details"),
          state: modeLabels.raw,
          largeImageText: appName,
          smallImageText: modeLabels.raw,
          buttons: defaultButtons,
        },
        proofreader_qc_mode: {
          details: t("discord.presence.proofreader.details"),
          state: modeLabels.proofreader,
          largeImageText: appName,
          smallImageText: modeLabels.proofreader,
          buttons: defaultButtons,
        },
        stitcher_mode: {
          details: t("discord.presence.stitch.details"),
          state: modeLabels.stitch,
          largeImageText: appName,
          smallImageText: modeLabels.stitch,
          buttons: defaultButtons,
        },
        splitter_mode: {
          details: t("discord.presence.split.details"),
          state: modeLabels.split,
          largeImageText: appName,
          smallImageText: modeLabels.split,
          buttons: defaultButtons,
        },
        watermark_mode: {
          details: t("discord.presence.watermark.details"),
          state: modeLabels.watermark,
          largeImageText: appName,
          smallImageText: modeLabels.watermark,
          buttons: defaultButtons,
        },
        enhance_mode: {
          details: t("discord.presence.enhance.details"),
          state: modeLabels.enhance,
          largeImageText: appName,
          smallImageText: modeLabels.enhance,
          buttons: defaultButtons,
        },
        chapter_optimizer_mode: {
          details: t("discord.presence.optimizer.details"),
          state: modeLabels.optimizer,
          largeImageText: appName,
          smallImageText: modeLabels.optimizer,
          buttons: defaultButtons,
        },
        blogger_cdn_mode: {
          details: t("discord.presence.blogger.details"),
          state: modeLabels.blogger,
          largeImageText: appName,
          smallImageText: modeLabels.blogger,
          buttons: defaultButtons,
        },
        image_upload_mode: {
          details: t("discord.presence.imgur.details"),
          state: modeLabels.imgur,
          largeImageText: appName,
          smallImageText: modeLabels.imgur,
          buttons: defaultButtons,
        },
        guides_tutorials: {
          details: t("discord.presence.guides.details"),
          state: modeLabels.guides,
          largeImageText: appName,
          smallImageText: modeLabels.guides,
          buttons: defaultButtons,
        },
        resources_materials: {
          details: t("discord.presence.resources.details"),
          state: modeLabels.resources,
          largeImageText: appName,
          smallImageText: modeLabels.resources,
          buttons: defaultButtons,
        },
        settings: {
          details: t("discord.presence.settings.details"),
          state: routePresetLabels.settings,
          largeImageText: appName,
          smallImageText: routePresetLabels.settings,
          buttons: defaultButtons,
        },
        rankings: {
          details: t("discord.presence.rankings.details"),
          state: routePresetLabels.rankings,
          largeImageText: appName,
          smallImageText: routePresetLabels.rankings,
          buttons: defaultButtons,
        },
        scanlation_feed: {
          details: t("discord.presence.scanlationFeed.details"),
          state: routePresetLabels.scanlationFeed,
          largeImageText: appName,
          smallImageText: routePresetLabels.scanlationFeed,
          buttons: defaultButtons,
        },
        login_register: {
          details: t("discord.presence.loginRegister.details"),
          state: routePresetLabels.loginRegister,
          largeImageText: appName,
          smallImageText: routePresetLabels.loginRegister,
          buttons: defaultButtons,
        },
        batch_mode: {
          details: t("discord.presence.batch.details"),
          state: t("discord.presence.batch.state", { current: 1, total: 1 }),
          largeImageText: appName,
          smallImageText: t("discord.presence.batch.label"),
          buttons: defaultButtons,
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
      await setPreset("workspace_idle", {
        details: t("discord.presence.workspace.details"),
        state: toDashboardName(user, t("dashboard.user.defaultName")),
      });
      return;
    }
    await setPreset("idle", {
      details: t("discord.presence.idle.details"),
      state: t("discord.presence.idle.state"),
    });
  }, [setPreset, t, user]);

  const setCleaning = useCallback(
    async (fileName: string, mode: DiscordProcessingMode): Promise<void> => {
      const trimmedFile = fileName.trim();
      await setPreset("cleaner_redraw_mode", {
        details: trimmedFile
          ? t("discord.presence.cleaner.fileDetails", { fileName: trimmedFile })
          : t("discord.presence.cleaner.details"),
        state:
          mode === "advanced"
            ? t("discord.presence.cleaner.state.advanced")
            : t("discord.presence.cleaner.state.basic"),
      });
    },
    [setPreset, t],
  );

  const setTranslating = useCallback(
    async (fileName: string, from: string, to: string): Promise<void> => {
      await setPreset("translator_mode", {
        details: t("discord.presence.translator.fileDetails", { fileName }),
        state: `${from} -> ${to}`,
      });
    },
    [setPreset, t],
  );

  const setTyping = useCallback(
    async (fileName: string): Promise<void> => {
      await setPreset("typesetter_mode", {
        details: t("discord.presence.typesetter.fileDetails", { fileName }),
        state: modeLabels.typesetter,
      });
    },
    [modeLabels.typesetter, setPreset, t],
  );

  const setRedrawing = useCallback(
    async (fileName: string): Promise<void> => {
      await setPreset("cleaner_redraw_mode", {
        details: t("discord.presence.redraw.fileDetails", { fileName }),
        state: modeLabels.cleaner,
      });
    },
    [modeLabels.cleaner, setPreset, t],
  );

  const setBatch = useCallback(
    async (fileCount: number, currentIndex: number, fileName?: string): Promise<void> => {
      await setPreset("batch_mode", {
        details: fileName
          ? t("discord.presence.batch.fileDetails", { fileName })
          : t("discord.presence.batch.details"),
        state: t("discord.presence.batch.state", {
          current: currentIndex,
          total: fileCount,
        }),
      });
    },
    [setPreset, t],
  );

  const setIdle = useCallback(async (): Promise<void> => {
    await setPreset("idle", {
      details: t("discord.presence.idle.details"),
      state: t("discord.presence.idle.state"),
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
