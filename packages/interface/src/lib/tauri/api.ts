import { invoke, isTauri } from "@tauri-apps/api/core";
import type { InvokeArgs, InvokeOptions } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Event,
  Options as ListenOptions,
  UnlistenFn,
} from "@tauri-apps/api/event";
import {
  desktopCommandChannels,
  updaterCommandChannels,
} from "@shared/desktop-api";
import type {
  AuthLoginPayload,
  AuthRegisterPayload,
  AuthConfigPayload,
  AuthTravelTokenRequest,
  AuthTravelTokenPayload,
  DeepLinkExtractPayload,
  DeepLinkUrlPayload,
  DesktopCommandName,
  DesktopApiEnvelope,
  DesktopFontEntry,
  DesktopFontsListResult,
  DesktopImageAllowedEntry,
  DesktopImageFolderEntry,
  DesktopImageFolderPayload,
  DesktopModelDownloadPayload,
  DesktopModelImportOnnxPayload,
  DesktopSessionLogPayload,
  DiscordWebhookPayload,
  FontImportPayload,
  FontInstallPayload,
  FontUninstallPayload,
  IDesktopBridge,
  IUpdaterBridge,
  JsonRecord,
  LlmProfilePayload,
  RuntimeConfig,
  UpdaterCommandName,
} from "@shared/desktop-api";
import type {
  DesktopEventName,
  DesktopEventPayloadMap,
  MiniBackendRuntimeListener,
  ModelManagerListener,
  UpdaterEventName,
  UpdaterEventPayload,
  UpdaterListener,
  UpdaterStatusPayload,
} from "@shared/desktop-events";

export type TauriCommandName = DesktopCommandName | UpdaterCommandName;
export type TauriCommandArgs = InvokeArgs | undefined;

export const invokeCommand = <TResponse = unknown>(
  command: TauriCommandName,
  args?: TauriCommandArgs,
  options?: InvokeOptions,
): Promise<TResponse> => {
  if (options !== undefined) {
    return invoke<TResponse>(command, args, options);
  }

  if (args !== undefined) {
    return invoke<TResponse>(command, args);
  }

  return invoke<TResponse>(command);
};

export const listenToDesktopEvent = <TName extends DesktopEventName>(
  eventName: TName,
  handler: (
    payload: DesktopEventPayloadMap[TName],
    event: Event<DesktopEventPayloadMap[TName]>,
  ) => void,
  options?: ListenOptions,
): Promise<UnlistenFn> => {
  const listener = (event: Event<DesktopEventPayloadMap[TName]>): void => {
    handler(event.payload, event);
  };

  return options === undefined
    ? listen<DesktopEventPayloadMap[TName]>(eventName, listener)
    : listen<DesktopEventPayloadMap[TName]>(eventName, listener, options);
};

const envString = (key: string): string | undefined => {
  const value = import.meta.env[key] as string | undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const DEFAULT_AUTH_API_URL = "http://127.0.0.1:3001";
const DEFAULT_LOCAL_API_URL = "http://127.0.0.1:8001";

const preferBuildEnvForDefault = (
  runtimeValue: string,
  defaultValue: string,
  buildValue: string | undefined,
): string => (buildValue && runtimeValue === defaultValue ? buildValue : runtimeValue);

const buildDefaultRuntimeConfig = (): RuntimeConfig => ({
  authApiUrl: envString("VITE_AUTH_API_URL") ?? DEFAULT_AUTH_API_URL,
  localApiUrl: envString("VITE_LOCAL_API_URL") ?? DEFAULT_LOCAL_API_URL,
  runtimeArtifactsUrl:
    envString("VITE_MINI_BACKEND_ARTIFACTS_URL") ??
    envString("VITE_UPDATE_SERVER_URL"),
  appPackaged: import.meta.env.PROD,
});

const mergeRuntimeConfigWithBuildEnv = (runtimeConfig: RuntimeConfig): RuntimeConfig => ({
  ...runtimeConfig,
  authApiUrl: preferBuildEnvForDefault(
    runtimeConfig.authApiUrl,
    DEFAULT_AUTH_API_URL,
    envString("VITE_AUTH_API_URL"),
  ),
  localApiUrl: preferBuildEnvForDefault(
    runtimeConfig.localApiUrl,
    DEFAULT_LOCAL_API_URL,
    envString("VITE_LOCAL_API_URL"),
  ),
  runtimeArtifactsUrl:
    runtimeConfig.runtimeArtifactsUrl ??
    envString("VITE_MINI_BACKEND_ARTIFACTS_URL") ??
    envString("VITE_UPDATE_SERVER_URL"),
});

let runtimeConfigCache = buildDefaultRuntimeConfig();

export const isTauriRuntime = (): boolean => {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return true;
  }

  try {
    return isTauri();
  } catch {
    return false;
  }
};

export const hydrateTauriRuntimeConfig = async (): Promise<RuntimeConfig> => {
  if (!isTauriRuntime()) {
    return runtimeConfigCache;
  }

  runtimeConfigCache = mergeRuntimeConfigWithBuildEnv(await invokeCommand<RuntimeConfig>(
    desktopCommandChannels.runtime.getRuntimeConfig,
  ));
  return runtimeConfigCache;
};

export const getCachedTauriRuntimeConfig = (): RuntimeConfig => runtimeConfigCache;

const registerListener = <TListener>(
  listeners: Map<TListener, Promise<UnlistenFn>>,
  listener: TListener,
  unlistenPromise: Promise<UnlistenFn>,
): void => {
  listeners.set(listener, unlistenPromise);
  void unlistenPromise.catch((error) => {
    console.error("[desktopBridge] Failed to register event listener", error);
    listeners.delete(listener);
  });
};

const unregisterListener = <TListener>(
  listeners: Map<TListener, Promise<UnlistenFn>>,
  listener: TListener,
): void => {
  const unlistenPromise = listeners.get(listener);
  listeners.delete(listener);
  if (!unlistenPromise) {
    return;
  }
  void unlistenPromise.then((unlisten) => unlisten()).catch((error) => {
    console.error("[desktopBridge] Failed to unregister event listener", error);
  });
};

const miniBackendRuntimeListeners = new Map<
  MiniBackendRuntimeListener,
  Promise<UnlistenFn>
>();
const modelManagerListeners = new Map<ModelManagerListener, Promise<UnlistenFn>>();
const updaterListeners = new Map<
  UpdaterEventName,
  Map<UpdaterListener, Promise<UnlistenFn>>
>();

const normalizeFontEntry = (entry: unknown): DesktopFontEntry | null => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const family = typeof record.family === "string" ? record.family : "";
  const fileName = typeof record.fileName === "string" ? record.fileName : "";
  const dataUrl = typeof record.dataUrl === "string" ? record.dataUrl : "";
  if (!family || !fileName || !dataUrl) {
    return null;
  }

  return {
    id: fileName,
    family,
    source: typeof record.source === "string" ? record.source : "custom",
    fileName,
    dataUrl,
  };
};

const normalizeFontsListResult = (value: unknown): DesktopFontsListResult => {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const system = Array.isArray(record.system)
    ? record.system.filter((item): item is string => typeof item === "string")
    : [];
  const custom = Array.isArray(record.custom)
    ? record.custom
        .map((entry) => normalizeFontEntry(entry))
        .filter((entry): entry is DesktopFontEntry => entry !== null)
    : [];

  return { system, custom };
};

const tauriDesktopBridge: IDesktopBridge = {
  getRuntimeConfig: getCachedTauriRuntimeConfig,
  getMiniBackendRuntimeState: () =>
    invokeCommand(desktopCommandChannels.runtime.getMiniBackendRuntimeState),
  listMiniBackendRuntimeArtifacts: () =>
    invokeCommand(desktopCommandChannels.runtime.listMiniBackendRuntimeArtifacts),
  installRecommendedMiniBackendRuntime: () =>
    invokeCommand(
      desktopCommandChannels.runtime.installRecommendedMiniBackendRuntime,
    ),
  installMiniBackendRuntimeProfile: (profile) =>
    invokeCommand(
      desktopCommandChannels.runtime.installMiniBackendRuntimeProfile,
      { profile },
    ),
  resetLocalSettings: () =>
    invokeCommand(desktopCommandChannels.runtime.resetLocalSettings),
  restartApp: () => invokeCommand(desktopCommandChannels.runtime.restartApp),
  onMiniBackendRuntimeState: (listener) => {
    registerListener(
      miniBackendRuntimeListeners,
      listener,
      listenToDesktopEvent("mini-backend-runtime:event", listener),
    );
  },
  offMiniBackendRuntimeState: (listener) => {
    unregisterListener(miniBackendRuntimeListeners, listener);
  },
  locale: {
    getPreferences: () => invokeCommand(desktopCommandChannels.locale.getPreferences),
  },
  checkLocalBackend: () => invokeCommand(desktopCommandChannels.localBackend.check),
  restartLocalBackend: () =>
    invokeCommand(desktopCommandChannels.localBackend.restart),
  sessionLog: (payload: DesktopSessionLogPayload) =>
    invokeCommand<void>(desktopCommandChannels.logging.sessionLog, { payload }),
  openExternal: (url: string) =>
    invokeCommand<void>(desktopCommandChannels.links.openExternal, { url }),
  openCommunityLink: (url: string) =>
    invokeCommand<void>(desktopCommandChannels.links.openCommunityLink, { url }),
  models: {
    listInstalled: () => invokeCommand(desktopCommandChannels.models.listInstalled),
    getDiskSpace: () => invokeCommand(desktopCommandChannels.models.getDiskSpace),
    checkUpdates: (payloads) =>
      invokeCommand(desktopCommandChannels.models.checkUpdates, { payloads }),
    download: (payload: DesktopModelDownloadPayload) =>
      invokeCommand(desktopCommandChannels.models.download, { payload }),
    importOnnx: (payload: DesktopModelImportOnnxPayload) =>
      invokeCommand(desktopCommandChannels.models.importOnnx, { payload }),
    cancel: (modelId: string) =>
      invokeCommand(desktopCommandChannels.models.cancel, { modelId }),
    cancelAll: () => invokeCommand(desktopCommandChannels.models.cancelAll),
    uninstall: (modelId: string) =>
      invokeCommand(desktopCommandChannels.models.uninstall, { modelId }),
    on: (listener: ModelManagerListener) => {
      registerListener(
        modelManagerListeners,
        listener,
        listenToDesktopEvent("model-manager:event", listener),
      );
    },
    off: (listener: ModelManagerListener) => {
      unregisterListener(modelManagerListeners, listener);
    },
  },
  workspace: {
    loadAutosave: (userId?: string | null) =>
      invokeCommand(desktopCommandChannels.workspace.loadAutosave, {
        userId: userId ?? null,
      }),
    saveAutosave: (payload) =>
      invokeCommand(desktopCommandChannels.workspace.saveAutosave, {
        userId: payload.userId ?? null,
        payload: payload.payload,
      }),
    clearAutosave: (payload) =>
      invokeCommand(desktopCommandChannels.workspace.clearAutosave, {
        userId:
          typeof payload?.userId === "string" || payload?.userId === null
            ? payload.userId
            : null,
      }),
    exportCurrent: (payload) =>
      invokeCommand(desktopCommandChannels.workspace.exportCurrent, {
        defaultFileName: payload.defaultFileName,
        payload: payload.payload,
      }),
    importFile: () => invokeCommand(desktopCommandChannels.workspace.importFile),
  },
  api: {
    auth: {
      config: () =>
        invokeCommand<DesktopApiEnvelope<AuthConfigPayload>>(
          desktopCommandChannels.api.auth.config,
        ),
      session: () => invokeCommand(desktopCommandChannels.api.auth.session),
      refreshSession: () =>
        invokeCommand(desktopCommandChannels.api.auth.refreshSession),
      login: (payload: AuthLoginPayload) =>
        invokeCommand(desktopCommandChannels.api.auth.login, { payload }),
      register: (payload: AuthRegisterPayload) =>
        invokeCommand(desktopCommandChannels.api.auth.register, { payload }),
      setTravelToken: (token: string) =>
        invokeCommand(desktopCommandChannels.api.auth.setTravelToken, {
          payload: { token },
        }),
      createTravelToken: (payload?: AuthTravelTokenRequest) =>
        invokeCommand<DesktopApiEnvelope<AuthTravelTokenPayload>>(
          desktopCommandChannels.api.auth.createTravelToken,
          { payload: payload ?? {} },
        ),
      verifyEmail: (accessToken: string) =>
        invokeCommand(desktopCommandChannels.api.auth.verifyEmail, {
          payload: { accessToken },
        }),
      confirmEmail: (token: string) =>
        invokeCommand(desktopCommandChannels.api.auth.confirmEmail, {
          payload: { token },
        }),
      forgotPassword: (email: string) =>
        invokeCommand(desktopCommandChannels.api.auth.forgotPassword, {
          payload: { email },
        }),
      resetPassword: (token: string, password: string) =>
        invokeCommand(desktopCommandChannels.api.auth.resetPassword, {
          payload: { token, password },
        }),
      signOut: () => invokeCommand(desktopCommandChannels.api.auth.signOut),
    },
    fonts: {
      list: async () =>
        normalizeFontsListResult(
          await invokeCommand(desktopCommandChannels.api.fonts.list),
        ),
      import: (payload: FontImportPayload) =>
        invokeCommand(desktopCommandChannels.api.fonts.import, { payload }),
      install: (payload: FontInstallPayload) =>
        invokeCommand(desktopCommandChannels.api.fonts.install, { payload }),
      uninstall: (payload: FontUninstallPayload) =>
        invokeCommand(desktopCommandChannels.api.fonts.uninstall, { payload }),
    },
    llmProfiles: {
      list: (userId: string) =>
        invokeCommand(desktopCommandChannels.api.llmProfiles.list, {
          payload: { userId },
        }),
      save: (userId: string, profile: LlmProfilePayload) =>
        invokeCommand(desktopCommandChannels.api.llmProfiles.save, {
          payload: { userId, profile },
        }),
      remove: (userId: string, profileId: string) =>
        invokeCommand(desktopCommandChannels.api.llmProfiles.remove, {
          payload: { userId, profileId },
        }),
    },
    blogger: {
      loadConfig: () => invokeCommand(desktopCommandChannels.api.blogger.loadConfig),
      saveConfig: (config) =>
        invokeCommand(desktopCommandChannels.api.blogger.saveConfig, {
          payload: config,
        }),
      testConnection: (config) =>
        invokeCommand(desktopCommandChannels.api.blogger.testConnection, {
          payload: config ?? {},
        }),
      uploadImages: (payload) =>
        invokeCommand(desktopCommandChannels.api.blogger.uploadImages, { payload }),
      publishPost: (payload) =>
        invokeCommand(desktopCommandChannels.api.blogger.publishPost, { payload }),
    },
    imgur: {
      loadConfig: () => invokeCommand(desktopCommandChannels.api.imgur.loadConfig),
      saveConfig: (config) =>
        invokeCommand(desktopCommandChannels.api.imgur.saveConfig, {
          payload: config,
        }),
      uploadImages: (payload) =>
        invokeCommand(desktopCommandChannels.api.imgur.uploadImages, { payload }),
    },
    discordWebhook: {
      send: (payload: DiscordWebhookPayload) =>
        invokeCommand(desktopCommandChannels.api.discordWebhook.send, { payload }),
    },
    bugReport: {
      prepare: () => invokeCommand(desktopCommandChannels.api.bugReport.prepare),
      submit: (payload) =>
        invokeCommand(desktopCommandChannels.api.bugReport.submit, { payload }),
    },
    identity: {
      hardwareId: () => invokeCommand(desktopCommandChannels.api.identity.hardwareId),
      machineFingerprint: () =>
        invokeCommand(desktopCommandChannels.api.identity.machineFingerprint),
    },
    integrations: {
      deepLinkExtract: (payload: DeepLinkExtractPayload) =>
        invokeCommand<string | null>(
          desktopCommandChannels.api.integrations.deepLinkExtract,
          { payload },
        ),
      deepLinkRoute: (payload: DeepLinkUrlPayload) =>
        invokeCommand<string | null>(
          desktopCommandChannels.api.integrations.deepLinkRoute,
          { payload },
        ),
      deepLinkFormat: (payload: DeepLinkUrlPayload) =>
        invokeCommand<string>(
          desktopCommandChannels.api.integrations.deepLinkFormat,
          { payload },
        ),
      deepLinkNavigate: (payload: DeepLinkUrlPayload) =>
        invokeCommand(desktopCommandChannels.api.integrations.deepLinkNavigate, {
          payload,
        }),
    },
    security: {
      certPinningSnapshot: () =>
        invokeCommand(desktopCommandChannels.api.security.certPinningSnapshot),
    },
  },
  images: {
    listFolder: (payload: DesktopImageFolderPayload) =>
      invokeCommand<DesktopImageFolderEntry[]>(
        desktopCommandChannels.images.listFolder,
        { folderPath: payload.folderPath },
      ),
    allowPaths: (paths: string[]) =>
      invokeCommand<DesktopImageAllowedEntry[]>(
        desktopCommandChannels.images.allowPaths,
        { paths },
      ),
  },
  discordRPC: {
    setEnabled: (enabled: boolean) =>
      invokeCommand<boolean>(desktopCommandChannels.discordRPC.setEnabled, {
        enabled,
      }),
    setActivity: (payload: unknown) =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.setActivity, {
        payload,
      }),
    setPreset: (preset: string, overrides?: JsonRecord) =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.setPreset, {
        payload: { preset, overrides: overrides ?? {} },
      }),
    setCleaning: (fileName: string, mode: string) =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.setCleaning, {
        payload: { fileName, mode },
      }),
    setTranslating: (fileName: string, from: string, to: string) =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.setTranslating, {
        payload: { fileName, from, to },
      }),
    setTyping: (fileName: string) =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.setTyping, {
        payload: { fileName },
      }),
    setRedrawing: (fileName: string) =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.setRedrawing, {
        payload: { fileName },
      }),
    setDashboard: (userName: string) =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.setDashboard, {
        payload: { userName },
      }),
    setBatchProcessing: (
      fileCount: number,
      currentIndex: number,
      fileName?: string,
    ) =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.setBatchProcessing, {
        payload: { fileCount, currentIndex, fileName },
      }),
    setIdle: () => invokeCommand<void>(desktopCommandChannels.discordRPC.setIdle),
    clearActivity: () =>
      invokeCommand<void>(desktopCommandChannels.discordRPC.clearActivity),
    isConnected: () =>
      invokeCommand<boolean>(desktopCommandChannels.discordRPC.isConnected),
    isEnabled: () =>
      invokeCommand<boolean>(desktopCommandChannels.discordRPC.isEnabled),
    getPresetAssets: () =>
      invokeCommand<Record<string, string>>(
        desktopCommandChannels.discordRPC.getPresetAssets,
      ),
  },
};

const updaterBridge: IUpdaterBridge = {
  check: (manifestUrl?: string) =>
    manifestUrl
      ? invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.check, {
          manifestUrl,
        })
      : invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.check),
  download: () =>
    invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.download),
  install: () => invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.install),
  rollback: () =>
    invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.rollback),
  postpone: () =>
    invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.postpone),
  getStatus: () =>
    invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.getStatus),
  setChannel: (channel) =>
    invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.setChannel, {
      channel,
    }),
  setAutoInstall: (enabled) =>
    invokeCommand<UpdaterStatusPayload>(updaterCommandChannels.setAutoInstall, {
      enabled,
    }),
  on: (eventName, listener) => {
    const listenersForEvent =
      updaterListeners.get(eventName) ?? new Map<UpdaterListener, Promise<UnlistenFn>>();
    updaterListeners.set(eventName, listenersForEvent);
    registerListener(
      listenersForEvent,
      listener,
      listenToDesktopEvent("updater:event", (payload: UpdaterEventPayload) => {
        if (payload.event === eventName) {
          listener(payload);
        }
      }),
    );
  },
  off: (eventName, listener) => {
    const listenersForEvent = updaterListeners.get(eventName);
    if (!listenersForEvent) {
      return;
    }
    unregisterListener(listenersForEvent, listener);
    if (listenersForEvent.size === 0) {
      updaterListeners.delete(eventName);
    }
  },
  offAll: (eventName?: UpdaterEventName) => {
    const entries =
      eventName === undefined
        ? Array.from(updaterListeners.entries())
        : ([[eventName, updaterListeners.get(eventName)]] as const);
    entries.forEach(([name, listenersForEvent]) => {
      if (!listenersForEvent) {
        return;
      }
      Array.from(listenersForEvent.keys()).forEach((listener) => {
        unregisterListener(listenersForEvent, listener);
      });
      updaterListeners.delete(name);
    });
  },
};

const resolveDesktopBridge = (): IDesktopBridge | null => {
  return isTauriRuntime() ? tauriDesktopBridge : null;
};

const resolveUpdaterBridge = (): IUpdaterBridge | null => {
  return isTauriRuntime() ? updaterBridge : null;
};

export const tauriApi = {
  get desktop(): IDesktopBridge | null {
    return resolveDesktopBridge();
  },
  get updater(): IUpdaterBridge | null {
    return resolveUpdaterBridge();
  },
  isDesktopRuntime: isTauriRuntime,
  getRuntimeConfig: getCachedTauriRuntimeConfig,
  hydrateRuntimeConfig: hydrateTauriRuntimeConfig,
};
