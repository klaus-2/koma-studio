import { desktopCommandChannels } from "@shared/desktop-api";
import type {
  DesktopCommandName,
  DesktopSessionLogPayload,
  IDesktopBridge,
  RuntimeConfig,
} from "@shared/desktop-api";
import type { ModelManagerEvent, ModelManagerListener } from "@shared/desktop-events";
import type { DesktopBridgeProvider } from "@koma/interface/lib/desktop-bridge";

const call = <T>(
  channel: DesktopCommandName,
  args: Record<string, unknown> = {},
): Promise<T> => {
  window.__e2eChannels ??= [];
  window.__e2eChannels.push(channel);
  const host = window.__komaE2EHostCall;
  if (!host) {
    return Promise.reject(new Error("E2E host bridge is not installed"));
  }
  return host<T>(channel, args);
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const modelListeners = new Set<ModelManagerListener>();
const miniBackendListeners = new Set<
  Parameters<IDesktopBridge["onMiniBackendRuntimeState"]>[0]
>();

window.__e2eDispatchModelEvent = (event: ModelManagerEvent): void => {
  for (const listener of modelListeners) {
    listener(event);
  }
};

const channels = desktopCommandChannels;

const desktop: IDesktopBridge = {
  getRuntimeConfig: () => runtimeConfig,
  getMiniBackendRuntimeState: () =>
    call(channels.runtime.getMiniBackendRuntimeState),
  listMiniBackendRuntimeArtifacts: () =>
    call(channels.runtime.listMiniBackendRuntimeArtifacts),
  installRecommendedMiniBackendRuntime: () =>
    call(channels.runtime.installRecommendedMiniBackendRuntime),
  installMiniBackendRuntimeProfile: (profile) =>
    call(channels.runtime.installMiniBackendRuntimeProfile, { profile }),
  resetLocalSettings: () => call(channels.runtime.resetLocalSettings),
  restartApp: () => call(channels.runtime.restartApp),
  onMiniBackendRuntimeState: (listener) => {
    miniBackendListeners.add(listener);
  },
  offMiniBackendRuntimeState: (listener) => {
    miniBackendListeners.delete(listener);
  },
  locale: {
    getPreferences: () => call(channels.locale.getPreferences),
  },
  checkLocalBackend: () => call(channels.localBackend.check),
  restartLocalBackend: () => call(channels.localBackend.restart),
  sessionLog: (payload: DesktopSessionLogPayload) =>
    call(channels.logging.sessionLog, { payload }),
  openExternal: (url) => call(channels.links.openExternal, { url }),
  openCommunityLink: (url) => call(channels.links.openCommunityLink, { url }),
  models: {
    listInstalled: () => call(channels.models.listInstalled),
    getDiskSpace: () => call(channels.models.getDiskSpace),
    checkUpdates: (payloads) =>
      call(channels.models.checkUpdates, { payloads }),
    download: (payload) => call(channels.models.download, { payload }),
    importOnnx: (payload) => call(channels.models.importOnnx, { payload }),
    cancel: (modelId) => call(channels.models.cancel, { modelId }),
    cancelAll: () => call(channels.models.cancelAll),
    uninstall: (modelId) => call(channels.models.uninstall, { modelId }),
    on: (listener) => {
      modelListeners.add(listener);
    },
    off: (listener) => {
      modelListeners.delete(listener);
    },
  },
  workspace: {
    loadAutosave: (userId) =>
      call(channels.workspace.loadAutosave, { userId: userId ?? null }),
    saveAutosave: (payload) =>
      call(channels.workspace.saveAutosave, {
        userId: payload.userId ?? null,
        payload: payload.payload,
      }),
    sendAutosave: (payload) => {
      void call(channels.workspace.saveAutosave, {
        userId: payload.userId ?? null,
        payload: payload.payload,
      }).catch(() => undefined);
    },
    clearAutosave: (payload) =>
      call(channels.workspace.clearAutosave, {
        userId:
          typeof payload?.userId === "string" || payload?.userId === null
            ? payload.userId
            : null,
      }),
    exportCurrent: (payload) =>
      call(channels.workspace.exportCurrent, {
        defaultFileName: payload.defaultFileName,
        payload: payload.payload,
      }),
    importFile: () => call(channels.workspace.importFile),
  },
  files: {
    saveBlob: async (payload) =>
      call(channels.files.saveBlob, {
        defaultFileName: payload.defaultFileName,
        dataBase64: toBase64(payload.data),
      }),
  },
  api: {
    auth: {
      config: () => call(channels.api.auth.config),
      session: () => call(channels.api.auth.session),
      refreshSession: () => call(channels.api.auth.refreshSession),
      login: (payload) => call(channels.api.auth.login, { payload }),
      register: (payload) => call(channels.api.auth.register, { payload }),
      setTravelToken: (token) =>
        call(channels.api.auth.setTravelToken, { payload: { token } }),
      createTravelToken: (payload) =>
        call(channels.api.auth.createTravelToken, { payload: payload ?? {} }),
      verifyEmail: (accessToken) =>
        call(channels.api.auth.verifyEmail, { payload: { accessToken } }),
      confirmEmail: (token) =>
        call(channels.api.auth.confirmEmail, { payload: { token } }),
      forgotPassword: (email) =>
        call(channels.api.auth.forgotPassword, { payload: { email } }),
      resetPassword: (token, password) =>
        call(channels.api.auth.resetPassword, { payload: { token, password } }),
      signOut: () => call(channels.api.auth.signOut),
    },
    fonts: {
      list: () => call(channels.api.fonts.list),
      import: (payload) => call(channels.api.fonts.import, { payload }),
      install: (payload) => call(channels.api.fonts.install, { payload }),
      uninstall: (payload) => call(channels.api.fonts.uninstall, { payload }),
    },
    llmProfiles: {
      list: (userId) =>
        call(channels.api.llmProfiles.list, { payload: { userId } }),
      save: (userId, profile) =>
        call(channels.api.llmProfiles.save, { payload: { userId, profile } }),
      remove: (userId, profileId) =>
        call(channels.api.llmProfiles.remove, {
          payload: { userId, profileId },
        }),
      resolveKey: (userId, profileId) =>
        call(channels.api.llmProfiles.resolve, {
          payload: { userId, profileId },
        }),
    },
    blogger: {
      loadConfig: () => call(channels.api.blogger.loadConfig),
      saveConfig: (config) =>
        call(channels.api.blogger.saveConfig, { payload: config }),
      testConnection: (config) =>
        call(channels.api.blogger.testConnection, { payload: config ?? {} }),
      uploadImages: (payload) =>
        call(channels.api.blogger.uploadImages, { payload }),
      publishPost: (payload) =>
        call(channels.api.blogger.publishPost, { payload }),
    },
    imgur: {
      loadConfig: () => call(channels.api.imgur.loadConfig),
      saveConfig: (config) =>
        call(channels.api.imgur.saveConfig, { payload: config }),
      uploadImages: (payload) =>
        call(channels.api.imgur.uploadImages, { payload }),
    },
    discordWebhook: {
      send: (payload) =>
        call(channels.api.discordWebhook.send, { payload }),
    },
    bugReport: {
      prepare: () => call(channels.api.bugReport.prepare),
      submit: (payload) =>
        call(channels.api.bugReport.submit, { payload }),
    },
    identity: {
      hardwareId: () => call(channels.api.identity.hardwareId),
      machineFingerprint: () => call(channels.api.identity.machineFingerprint),
    },
    integrations: {
      deepLinkExtract: (payload) =>
        call(channels.api.integrations.deepLinkExtract, { payload }),
      deepLinkRoute: (payload) =>
        call(channels.api.integrations.deepLinkRoute, { payload }),
      deepLinkFormat: (payload) =>
        call(channels.api.integrations.deepLinkFormat, { payload }),
      deepLinkNavigate: (payload) =>
        call(channels.api.integrations.deepLinkNavigate, { payload }),
    },
    security: {
      certPinningSnapshot: () =>
        call(channels.api.security.certPinningSnapshot),
    },
  },
  images: {
    listFolder: (payload) =>
      call(channels.images.listFolder, {
        folderPath: payload.folderPath,
        ...(payload.cursor !== undefined ? { cursor: payload.cursor } : {}),
        ...(payload.limit !== undefined ? { limit: payload.limit } : {}),
      }),
    allowPaths: (paths) => call(channels.images.allowPaths, { paths }),
  },
  discordRPC: {
    setEnabled: (enabled) => call(channels.discordRPC.setEnabled, { enabled }),
    setActivity: (payload) => call(channels.discordRPC.setActivity, { payload }),
    setPreset: (preset, overrides) =>
      call(channels.discordRPC.setPreset, {
        payload: { preset, overrides: overrides ?? {} },
      }),
    setCleaning: (fileName, mode) =>
      call(channels.discordRPC.setCleaning, {
        payload: { fileName, mode },
      }),
    setTranslating: (fileName, from, to) =>
      call(channels.discordRPC.setTranslating, {
        payload: { fileName, from, to },
      }),
    setTyping: (fileName) =>
      call(channels.discordRPC.setTyping, { payload: { fileName } }),
    setRedrawing: (fileName) =>
      call(channels.discordRPC.setRedrawing, { payload: { fileName } }),
    setDashboard: (userName) =>
      call(channels.discordRPC.setDashboard, { payload: { userName } }),
    setBatchProcessing: (fileCount, currentIndex, fileName) =>
      call(channels.discordRPC.setBatchProcessing, {
        payload: { fileCount, currentIndex, fileName },
      }),
    setIdle: () => call(channels.discordRPC.setIdle),
    clearActivity: () => call(channels.discordRPC.clearActivity),
    isConnected: () => call(channels.discordRPC.isConnected),
    isEnabled: () => call(channels.discordRPC.isEnabled),
    getPresetAssets: () => call(channels.discordRPC.getPresetAssets),
  },
};

let runtimeConfig: RuntimeConfig = {
  authApiUrl: "http://127.0.0.1:3001",
  localApiUrl: "http://127.0.0.1:8001",
  appPackaged: false,
};

export const createE2eBridge = (config: RuntimeConfig): DesktopBridgeProvider => {
  runtimeConfig = config;
  return {
    desktop,
    isDesktopRuntime: () => true,
    getRuntimeConfig: () => runtimeConfig,
    hydrateRuntimeConfig: async () => runtimeConfig,
  };
};
