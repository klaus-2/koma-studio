import type {
  MiniBackendRuntimeListener,
  ModelManagerListener,
  MiniBackendRuntimeStatePayload,
  UpdaterEventName,
  UpdaterListener,
  UpdaterStatusPayload,
} from "./desktop-events";
import type {
  BloggerConfig,
  BloggerConnectionResult,
  BloggerPublishPayload,
  BloggerPublishResult,
  BloggerUploadPayload,
  BloggerUploadResult,
} from "./blogger";
import type {
  ImgurConfig,
  ImgurRateLimitStatus,
  ImgurUploadPayload,
  ImgurUploadResult,
} from "./imgur";
import type {
  WorkspaceAutosaveClearPayload,
  WorkspaceAutosaveClearResult,
  WorkspaceAutosaveLoadResult,
  WorkspaceAutosaveSavePayload,
  WorkspaceAutosaveSaveResult,
  WorkspaceExportPayload,
  WorkspaceExportResult,
  WorkspaceImportResult,
} from "./workspace";

export type JsonRecord = Record<string, unknown>;

type LeafValue<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? LeafValue<T[keyof T]>
    : never;

export interface RuntimeConfig {
  authApiUrl: string;
  localApiUrl: string;
  runtimeArtifactsUrl?: string;
  appPackaged: boolean;
}

export type ModelInstallStrategy =
  | "direct_download"
  | "backend_managed"
  | "manual_import";

export type ModelRuntimeFamily =
  | "onnx"
  | "onnx_bundle"
  | "enhance_onnx_bundle"
  | "pytorch_checkpoint"
  | "ctranslate2"
  | "gguf"
  | "safetensors_bundle"
  | "transformers_vlm"
  | "transformers_vlm_paddleocr_manga"
  | "managed_runtime";

export interface MiniBackendRuntimeInstallResult {
  ok: boolean;
  profile: string;
  reason: string | null;
}

export interface MiniBackendRuntimeArtifactOption {
  profile: string;
  version: string;
  size: number;
  installed: boolean;
  recommended: boolean;
}

export interface DesktopFontEntry {
  id: string;
  family: string;
  source?: string;
  fileName: string;
  dataUrl: string;
}

export interface DesktopFontsListResult {
  system: string[];
  custom: DesktopFontEntry[];
}

export interface DesktopModelDownloadPayload {
  id: string;
  name: string;
  version: string;
  downloadUrl: string;
  checksumSHA256: string;
  expectedDownloadBytes: number;
  requiredDiskBytes: number;
  sourceLanguage?: string;
  installStrategy?: ModelInstallStrategy;
  runtimeFamily?: ModelRuntimeFamily;
  backendInstallEndpoint?: string;
}

export interface DesktopDiskSpaceInfo {
  freeBytes: number;
  totalBytes: number;
  path: string;
}

export interface DesktopInstalledModelRecord {
  modelId: string;
  version: string;
  installedAt: string;
  checksumSHA256: string;
  status: "installed" | "incomplete";
  installedLanguages?: string[];
  origin?: string | null;
  modelDir: string;
  manifestPath: string;
  sizeBytes: number;
}

export interface DesktopRemoteModelUpdateCheckResult {
  modelId: string;
  installedChecksumSHA256: string | null;
  remoteChecksumSHA256: string | null;
  registryVersion: string;
  checked: boolean;
  updateAvailable: boolean;
}

export interface DesktopModelQueueResult {
  queued: boolean;
  queueLength: number;
}

export interface DesktopModelImportOnnxPayload {
  id: string;
  name: string;
  version: string;
}

export interface AuthLoginPayload {
  email: string;
  password: string;
  captchaToken?: string;
  rememberMe?: boolean;
  travelToken?: string;
  locale?: string;
}

export interface AuthLegalAcceptancePayload {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
  cookiesVersion: string;
  contentVersion: string;
}

export interface AuthRegisterPayload {
  email: string;
  password: string;
  name?: string;
  captchaToken?: string;
  travelToken?: string;
  locale?: string;
  legalAcceptance?: AuthLegalAcceptancePayload;
}

export interface AuthTravelTokenRequest {
  ttlMinutes?: number;
  travelDays?: number;
  deliveryMode?: "copy" | "email";
}

export interface DesktopApiEnvelope<TPayload = JsonRecord> {
  ok: boolean;
  status: number;
  payload: TPayload | null;
}

export interface AuthConfigPayload extends JsonRecord {
  captchaEnabled?: boolean;
  turnstileSiteKey?: string | null;
  emailDeliveryEnabled?: boolean;
  desktopClientEnforced?: boolean;
}

export interface AuthTravelTokenPayload extends JsonRecord {
  success?: boolean;
  deliveryMode?: "copy" | "email";
  emailSent?: boolean;
  destinationMasked?: string;
  travelToken?: string;
  expiresAt?: string;
  travelDays?: number;
  error?: string;
  code?: string;
}

export interface FontImportPayload {
  fileName: string;
  contentBase64: string;
  family?: string;
}

export type FontInstallPayload = FontImportPayload;

export interface FontUninstallPayload {
  fileName: string;
}

export interface LlmProfilePayload {
  id: string;
  stage: "translation" | "ocr" | "clean";
  label: string;
  apiBase: string;
  apiKey: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscordWebhookPayload {
  url: string;
  body: unknown;
}

export interface DiscordWebhookSendResult {
  ok: boolean;
  status: number;
  error?: string;
}

export type DesktopBugReportLogSource = "app" | "user" | "runtime";

export interface DesktopBugReportAutoLogEntry {
  id: string;
  name: string;
  size: number;
  source: DesktopBugReportLogSource;
}

export interface DesktopBugReportDiagnostics {
  timestamp: string;
  appVersion: string;
  platform: string;
  release: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  appPackaged: boolean;
  envMode: string;
  updateChannel: string;
  miniBackendRunning: boolean;
  miniBackendRuntimeLineCount: number;
  authApiUrl: string;
  localApiUrl: string;
  machineProfileSchemaVersion: number;
  machineProfile: JsonRecord | null;
  machineProfileSync: JsonRecord;
}

export interface DesktopBugReportPrepareResult {
  screenshotDataUrl: string | null;
  autoLogs: DesktopBugReportAutoLogEntry[];
  diagnostics: DesktopBugReportDiagnostics;
  ready?: boolean;
  error?: string;
}

export interface DesktopBugReportAttachmentPayload {
  name: string;
  mimeType?: string;
  size?: number;
  contentBase64: string;
}

export interface DesktopBugReportSubmitPayload {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  contact?: string;
  screenshotDataUrl?: string | null;
  autoLogIds?: string[];
  attachments?: DesktopBugReportAttachmentPayload[];
  context?: JsonRecord;
}

export interface DesktopBugReportSubmitResult {
  ok: boolean;
  status: number;
  screenshotUrl?: string;
  error?: string;
}

export interface DeepLinkExtractPayload {
  argv: string[];
}

export interface DeepLinkUrlPayload {
  url: string;
}

export interface DesktopImageFilePayload {
  filePath: string;
}

export interface DesktopImageFolderPayload {
  folderPath: string;
}

export interface DesktopImageFolderEntry {
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export const desktopCommandChannels = {
  runtime: {
    getRuntimeConfig: "desktop:get-runtime-config",
    getMiniBackendRuntimeState: "desktop:get-mini-backend-runtime-state",
    listMiniBackendRuntimeArtifacts:
      "desktop:list-mini-backend-runtime-artifacts",
    installRecommendedMiniBackendRuntime:
      "desktop:install-recommended-mini-backend-runtime",
    installMiniBackendRuntimeProfile:
      "desktop:install-mini-backend-runtime-profile",
    resetLocalSettings: "desktop:reset-local-settings",
    restartApp: "desktop:restart-app",
  },
  locale: {
    getPreferences: "desktop:locale:get-preferences",
  },
  localBackend: {
    check: "desktop:check-local-backend",
    restart: "desktop:restart-local-backend",
  },
  links: {
    openExternal: "desktop:open-external",
    openCommunityLink: "desktop:open-community-link",
  },
  logging: {
    sessionLog: "desktop:session-log",
  },
  models: {
    listInstalled: "desktop-models:list-installed",
    getDiskSpace: "desktop-models:get-disk-space",
    checkUpdates: "desktop-models:check-updates",
    download: "desktop-models:download",
    importOnnx: "desktop-models:import-onnx",
    cancel: "desktop-models:cancel",
    cancelAll: "desktop-models:cancel-all",
    uninstall: "desktop-models:uninstall",
  },
  workspace: {
    loadAutosave: "desktop-workspace:load-autosave",
    saveAutosave: "desktop-workspace:save-autosave",
    clearAutosave: "desktop-workspace:clear-autosave",
    exportCurrent: "desktop-workspace:export-current",
    importFile: "desktop-workspace:import-file",
  },
  api: {
    auth: {
      config: "desktop-api:auth:config",
      session: "desktop-api:auth:session",
      refreshSession: "desktop-api:auth:refresh-session",
      login: "desktop-api:auth:login",
      register: "desktop-api:auth:register",
      setTravelToken: "desktop-api:auth:travel-token:set",
      createTravelToken: "desktop-api:auth:travel-token:create",
      verifyEmail: "desktop-api:auth:verify-email",
      confirmEmail: "desktop-api:auth:confirm-email",
      forgotPassword: "desktop-api:auth:forgot-password",
      resetPassword: "desktop-api:auth:reset-password",
      signOut: "desktop-api:auth:sign-out",
    },
    fonts: {
      list: "desktop-api:fonts:list",
      import: "desktop-api:fonts:import",
      install: "desktop-api:fonts:install",
      uninstall: "desktop-api:fonts:uninstall",
    },
    llmProfiles: {
      list: "desktop-api:llm-profiles:list",
      save: "desktop-api:llm-profiles:save",
      remove: "desktop-api:llm-profiles:remove",
    },
    blogger: {
      loadConfig: "desktop-api:blogger:config:load",
      saveConfig: "desktop-api:blogger:config:save",
      testConnection: "desktop-api:blogger:test-connection",
      uploadImages: "desktop-api:blogger:upload-images",
      publishPost: "desktop-api:blogger:publish-post",
    },
    imgur: {
      loadConfig: "desktop-api:imgur:config:load",
      saveConfig: "desktop-api:imgur:config:save",
      uploadImages: "desktop-api:imgur:upload-images",
    },
    discordWebhook: {
      send: "desktop-api:discord-webhook:send",
    },
    bugReport: {
      prepare: "desktop-api:bug-report:prepare",
      submit: "desktop-api:bug-report:submit",
    },
    identity: {
      hardwareId: "desktop-api:identity:hardware-id",
      machineFingerprint: "desktop-api:identity:machine-fingerprint",
    },
    integrations: {
      deepLinkExtract: "desktop-api:integrations:deep-link:extract",
      deepLinkRoute: "desktop-api:integrations:deep-link:route",
      deepLinkFormat: "desktop-api:integrations:deep-link:format",
      deepLinkNavigate: "desktop-api:integrations:deep-link:navigate",
    },
    security: {
      certPinningSnapshot: "desktop-api:security:cert-pinning:snapshot",
    },
  },
  images: {
    readFileAsDataUrl: "desktop-api:images:read-file",
    readFileBuffer: "desktop-api:images:read-buffer",
    listFolder: "desktop-api:images:list-folder",
  },
  discordRPC: {
    setEnabled: "discord-rpc:set-enabled",
    setActivity: "discord-rpc:set-activity",
    setPreset: "discord-rpc:set-preset",
    setCleaning: "discord-rpc:set-cleaning",
    setTranslating: "discord-rpc:set-translating",
    setTyping: "discord-rpc:set-typing",
    setRedrawing: "discord-rpc:set-redrawing",
    setDashboard: "discord-rpc:set-dashboard",
    setBatchProcessing: "discord-rpc:set-batch",
    setIdle: "discord-rpc:set-idle",
    clearActivity: "discord-rpc:clear-activity",
    isConnected: "discord-rpc:is-connected",
    isEnabled: "discord-rpc:is-enabled",
    getPresetAssets: "discord-rpc:get-preset-assets",
  },
} as const;

export const updaterCommandChannels = {
  check: "updater_check",
  download: "updater_download_incremental",
  install: "updater_apply",
  rollback: "updater_rollback",
  postpone: "updater_postpone",
  getStatus: "updater:get-status",
  setChannel: "updater:set-channel",
  setAutoInstall: "updater:set-auto-install",
} as const;

export type DesktopCommandName = LeafValue<typeof desktopCommandChannels>;
export type UpdaterCommandName = LeafValue<typeof updaterCommandChannels>;

export interface DesktopModelsApi {
  listInstalled(): Promise<DesktopInstalledModelRecord[]>;
  getDiskSpace(): Promise<DesktopDiskSpaceInfo>;
  checkUpdates(
    payloads: DesktopModelDownloadPayload[],
  ): Promise<DesktopRemoteModelUpdateCheckResult[]>;
  download(payload: DesktopModelDownloadPayload): Promise<DesktopModelQueueResult>;
  importOnnx(
    payload: DesktopModelImportOnnxPayload,
  ): Promise<DesktopInstalledModelRecord>;
  cancel(modelId: string): Promise<unknown>;
  cancelAll(): Promise<unknown>;
  uninstall(modelId: string): Promise<unknown>;
  on(listener: ModelManagerListener): void;
  off(listener: ModelManagerListener): void;
}

export interface DesktopWorkspaceApi {
  loadAutosave(userId?: string | null): Promise<WorkspaceAutosaveLoadResult>;
  saveAutosave(
    payload: WorkspaceAutosaveSavePayload,
  ): Promise<WorkspaceAutosaveSaveResult>;
  clearAutosave(
    payload?: WorkspaceAutosaveClearPayload,
  ): Promise<WorkspaceAutosaveClearResult>;
  exportCurrent(payload: WorkspaceExportPayload): Promise<WorkspaceExportResult>;
  importFile(): Promise<WorkspaceImportResult>;
}

export interface DesktopAuthApi {
  config(): Promise<DesktopApiEnvelope<AuthConfigPayload>>;
  session(): Promise<unknown>;
  refreshSession(): Promise<unknown>;
  login(payload: AuthLoginPayload): Promise<unknown>;
  register(payload: AuthRegisterPayload): Promise<unknown>;
  setTravelToken(token: string): Promise<unknown>;
  createTravelToken(
    payload?: AuthTravelTokenRequest,
  ): Promise<DesktopApiEnvelope<AuthTravelTokenPayload>>;
  verifyEmail(accessToken: string): Promise<unknown>;
  confirmEmail(token: string): Promise<unknown>;
  forgotPassword(email: string): Promise<unknown>;
  resetPassword(token: string, password: string): Promise<unknown>;
  signOut(): Promise<unknown>;
}

export interface DesktopApiNamespace {
  auth: DesktopAuthApi;
  fonts: {
    list(): Promise<DesktopFontsListResult>;
    import(payload: FontImportPayload): Promise<unknown>;
    install(payload: FontInstallPayload): Promise<unknown>;
    uninstall(payload: FontUninstallPayload): Promise<unknown>;
  };
  llmProfiles: {
    list(userId: string): Promise<unknown>;
    save(userId: string, profile: LlmProfilePayload): Promise<unknown>;
    remove(userId: string, profileId: string): Promise<unknown>;
  };
  blogger: {
    loadConfig(): Promise<{ config: BloggerConfig; secureStorage: boolean }>;
    saveConfig(
      config: BloggerConfig,
    ): Promise<{ config: BloggerConfig; secureStorage: boolean }>;
    testConnection(config?: BloggerConfig): Promise<BloggerConnectionResult>;
    uploadImages(
      payload: BloggerUploadPayload,
    ): Promise<{ items: BloggerUploadResult[]; optimizerApplied: boolean }>;
    publishPost(payload: BloggerPublishPayload): Promise<BloggerPublishResult>;
  };
  imgur: {
    loadConfig(): Promise<{
      config: ImgurConfig;
      secureStorage: boolean;
      rateLimit: ImgurRateLimitStatus;
    }>;
    saveConfig(config: ImgurConfig): Promise<{
      config: ImgurConfig;
      secureStorage: boolean;
      rateLimit: ImgurRateLimitStatus;
    }>;
    uploadImages(payload: ImgurUploadPayload): Promise<{
      items: ImgurUploadResult[];
      rateLimit: ImgurRateLimitStatus;
    }>;
  };
  discordWebhook: {
    send(payload: DiscordWebhookPayload): Promise<DiscordWebhookSendResult>;
  };
  bugReport: {
    prepare(): Promise<DesktopBugReportPrepareResult>;
    submit(
      payload: DesktopBugReportSubmitPayload,
    ): Promise<DesktopBugReportSubmitResult>;
  };
  identity: {
    hardwareId(): Promise<unknown>;
    machineFingerprint(): Promise<unknown>;
  };
  integrations: {
    deepLinkExtract(payload: DeepLinkExtractPayload): Promise<string | null>;
    deepLinkRoute(payload: DeepLinkUrlPayload): Promise<string | null>;
    deepLinkFormat(payload: DeepLinkUrlPayload): Promise<string>;
    deepLinkNavigate(payload: DeepLinkUrlPayload): Promise<unknown>;
  };
  security: {
    certPinningSnapshot(): Promise<unknown>;
  };
}

export interface DesktopImagesApi {
  readFileAsDataUrl(payload: DesktopImageFilePayload): Promise<unknown>;
  readFileBuffer(payload: DesktopImageFilePayload): Promise<unknown>;
  listFolder(
    payload: DesktopImageFolderPayload,
  ): Promise<DesktopImageFolderEntry[]>;
}

export interface DesktopSessionLogPayload {
  level?: "error" | "warn" | "info" | "debug" | "log";
  source?: "main" | "renderer" | string;
  message: string;
}

export interface DesktopDiscordRpcApi {
  setEnabled(enabled: boolean): Promise<boolean>;
  setActivity(data: unknown): Promise<void>;
  setPreset(preset: string, overrides?: JsonRecord): Promise<void>;
  setCleaning(fileName: string, mode: string): Promise<void>;
  setTranslating(fileName: string, from: string, to: string): Promise<void>;
  setTyping(fileName: string): Promise<void>;
  setRedrawing(fileName: string): Promise<void>;
  setDashboard(userName: string): Promise<void>;
  setBatchProcessing(
    fileCount: number,
    currentIndex: number,
    fileName?: string,
  ): Promise<void>;
  setIdle(): Promise<void>;
  clearActivity(): Promise<void>;
  isConnected(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  getPresetAssets(): Promise<Record<string, string>>;
}

export interface IDesktopBridge {
  getRuntimeConfig(): RuntimeConfig;
  getMiniBackendRuntimeState(): Promise<MiniBackendRuntimeStatePayload | null>;
  listMiniBackendRuntimeArtifacts(): Promise<MiniBackendRuntimeArtifactOption[]>;
  installRecommendedMiniBackendRuntime(): Promise<MiniBackendRuntimeInstallResult>;
  installMiniBackendRuntimeProfile(
    profile: string,
  ): Promise<MiniBackendRuntimeInstallResult>;
  resetLocalSettings(): Promise<unknown>;
  restartApp(): Promise<unknown>;
  onMiniBackendRuntimeState(listener: MiniBackendRuntimeListener): void;
  offMiniBackendRuntimeState(listener: MiniBackendRuntimeListener): void;
  locale: {
    getPreferences(): Promise<unknown>;
  };
  checkLocalBackend(): Promise<boolean>;
  restartLocalBackend(): Promise<boolean>;
  sessionLog(payload: DesktopSessionLogPayload): Promise<void>;
  openExternal(url: string): Promise<void>;
  openCommunityLink(url: string): Promise<void>;
  models: DesktopModelsApi;
  workspace: DesktopWorkspaceApi;
  api: DesktopApiNamespace;
  images: DesktopImagesApi;
  discordRPC: DesktopDiscordRpcApi;
}

export interface IUpdaterBridge {
  check(manifestUrl?: string): Promise<UpdaterStatusPayload>;
  download(): Promise<UpdaterStatusPayload>;
  install(): Promise<UpdaterStatusPayload>;
  rollback(): Promise<UpdaterStatusPayload>;
  postpone(): Promise<UpdaterStatusPayload>;
  getStatus(): Promise<UpdaterStatusPayload>;
  setChannel(channel: "stable" | "beta"): Promise<UpdaterStatusPayload>;
  setAutoInstall(enabled: boolean): Promise<UpdaterStatusPayload>;
  on(eventName: UpdaterEventName, listener: UpdaterListener): void;
  off(eventName: UpdaterEventName, listener: UpdaterListener): void;
  offAll(eventName?: UpdaterEventName): void;
}
