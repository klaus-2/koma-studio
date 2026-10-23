import type {
  MiniBackendRuntimeListener,
  ModelManagerListener,
  MiniBackendRuntimeStatePayload,
} from "./desktop-events";
import type { UpdaterSyncLogListener } from "./updaterSync";
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
  authDisabled?: boolean;
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
  | "transformers"
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
  /** Family name only — never a style instance or a file name. */
  family: string;
  source?: string;
  fileName: string;
  dataUrl: string;
}

export interface DesktopFontsListResult {
  /**
   * Family names only (see `DesktopFontEntry.family`), deduped case-insensitively, order not
   * significant. Empty means the shell could not ask the OS, not that nothing is installed.
   */
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

/**
 * Uniform bridge envelope for desktop auth/API calls.
 *
 * `status` mirrors the server HTTP status; `status: 0` is the BRIDGE-FAILURE
 * sentinel — the tauri transport emits it when the request could not reach
 * the server at all (see auth.rs session_api_fetch's ensure_session_token
 * failure path), so `ok === false` + `status === 0` means transport-level
 * failure rather than a server rejection.
 */
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

export interface DesktopImageAllowedEntry {
  filePath: string;
  mimeType: string;
  size: number;
}

export interface DesktopImageFolderPayload {
  folderPath: string;
  /** Opaque pagination cursor: the last file name of the previous page. */
  cursor?: string;
  /** Page size, 1-200 (default 100). */
  limit?: number;
}

export type DesktopImagePathFailureCode =
  | "invalid_path"
  | "unsupported_media_type"
  | "not_a_file"
  | "io"
  | "authorization_failed";

export type DesktopImageAllowOutcome =
  | { status: "allowed"; index: number; entry: DesktopImageAllowedEntry }
  | { status: "rejected"; index: number; code: DesktopImagePathFailureCode };

export interface DesktopImageFolderPage {
  entries: DesktopImageFolderEntry[];
  nextCursor: string | null;
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
    sendAutosave: "desktop-workspace:send-autosave",
    clearAutosave: "desktop-workspace:clear-autosave",
    exportCurrent: "desktop-workspace:export-current",
    importFile: "desktop-workspace:import-file",
  },
  files: {
    saveBlob: "desktop:files:save-blob",
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
      resolve: "desktop-api:llm-profiles:resolve-key",
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
    allowPaths: "desktop-api:images:allow-paths",
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

export type DesktopCommandName = LeafValue<typeof desktopCommandChannels>;

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
  /**
   * Fire-and-forget autosave for teardown (unmount / beforeunload).
   * Electron uses ipcRenderer.send so the message is queued before the
   * renderer dies.
   */
  sendAutosave(payload: WorkspaceAutosaveSavePayload): void;
  clearAutosave(
    payload?: WorkspaceAutosaveClearPayload,
  ): Promise<WorkspaceAutosaveClearResult>;
  exportCurrent(payload: WorkspaceExportPayload): Promise<WorkspaceExportResult>;
  importFile(): Promise<WorkspaceImportResult>;
}

/**
 * Session user as the desktop bridges deliver it (better-auth user plus the
 * workspace/profile fields the server attaches when present). Mirrors the
 * renderer's AuthUser (@koma/auth context) so bridge payloads assign to it.
 */
export interface DesktopAuthSessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  locale?: string;
  appRole?: "user" | "moderator" | "admin" | "owner";
  feedProfileStatus?: "pending_setup" | "active" | "suspended";
  authorNotificationWebhookConfigured?: boolean;
}

/** Session/login/register snapshot payload: the user plus the access token. */
export interface DesktopAuthSessionSnapshot {
  user: DesktopAuthSessionUser;
  accessToken: string;
}

export interface DesktopAuthApi {
  config(): Promise<DesktopApiEnvelope<AuthConfigPayload>>;
  /** payload is null when the bridge has no session (electron skips the
   * fetch without an auth cookie — desktop-auth-ipc.ts). */
  session(): Promise<DesktopApiEnvelope<DesktopAuthSessionSnapshot | null>>;
  refreshSession(): Promise<DesktopApiEnvelope<{ refreshed: boolean }>>;
  login(payload: AuthLoginPayload): Promise<DesktopApiEnvelope<DesktopAuthSessionSnapshot>>;
  register(payload: AuthRegisterPayload): Promise<DesktopApiEnvelope<DesktopAuthSessionSnapshot>>;
  setTravelToken(token: string): Promise<DesktopApiEnvelope<JsonRecord>>;
  createTravelToken(
    payload?: AuthTravelTokenRequest,
  ): Promise<DesktopApiEnvelope<AuthTravelTokenPayload>>;
  verifyEmail(accessToken: string): Promise<DesktopApiEnvelope<JsonRecord>>;
  confirmEmail(token: string): Promise<DesktopApiEnvelope<JsonRecord>>;
  forgotPassword(email: string): Promise<DesktopApiEnvelope<JsonRecord>>;
  resetPassword(token: string, password: string): Promise<DesktopApiEnvelope<JsonRecord>>;
  signOut(): Promise<void>;
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
    /** Keychain-backed shells only (Tauri). Electron returns keys inline. */
    resolveKey?(userId: string, profileId: string): Promise<unknown>;
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
  /** Tauri-only: widens the koma-image protocol scope for files picked outside list-folder. */
  allowPaths?(paths: string[]): Promise<DesktopImageAllowOutcome[]>;
  listFolder(
    payload: DesktopImageFolderPayload,
  ): Promise<DesktopImageFolderPage>;
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

export interface DesktopFilesApi {
  /**
   * Native save dialog + write. Returns cancelled when the user dismisses.
   */
  saveBlob(payload: {
    defaultFileName: string;
    data: ArrayBuffer;
  }): Promise<{ cancelled: boolean; filePath: string | null }>;
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
  files: DesktopFilesApi;
  api: DesktopApiNamespace;
  images: DesktopImagesApi;
  discordRPC: DesktopDiscordRpcApi;
}

export interface IUpdaterSyncBridge {
  start(): Promise<unknown>;
  cancel(): Promise<unknown>;
  rebuildAndRestart(): Promise<unknown>;
  getStatus(): Promise<unknown>;
  on(listener: UpdaterSyncLogListener): () => void;
}
