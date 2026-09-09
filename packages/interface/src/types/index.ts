import type {
  BloggerConfig,
  BloggerConnectionResult,
  BloggerPublishPayload,
  BloggerPublishResult,
  BloggerUploadPayload,
  BloggerUploadResult,
} from "../../../../packages/types/src/blogger";
import type {
  ImgurConfig,
  ImgurRateLimitStatus,
  ImgurUploadPayload,
  ImgurUploadResult,
} from "../../../../packages/types/src/imgur";
import type {
  WorkspaceAutosaveClearResult,
  WorkspaceAutosaveLoadResult,
  WorkspaceAutosaveSavePayload,
  WorkspaceExportPayload,
  WorkspaceExportResult,
  WorkspaceImportResult,
} from "../../../../packages/types/src/workspace";

export interface DesktopRuntimeConfig {
  authApiUrl: string;
  localApiUrl: string;
  runtimeArtifactsUrl?: string;
  appPackaged: boolean;
}

export interface DesktopMiniBackendRuntimeInstallResult {
  ok: boolean;
  profile: string;
  reason: string | null;
}

export interface DesktopMiniBackendRuntimeArtifactOption {
  profile: string;
  version: string;
  size: number;
  installed: boolean;
  recommended: boolean;
}

export interface DesktopMiniBackendRuntimeState {
  status:
    | "idle"
    | "resolving"
    | "checking"
    | "downloading"
    | "verifying"
    | "extracting"
    | "ready"
    | "fallback"
    | "error";
  statusMessage: string | null;
  requestedProfile: string;
  activeProfile: string;
  source: "bundled-core" | "downloaded-runtime";
  runtimeArtifactsUrl: string | null;
  runtimeManifestUrl: string | null;
  runtimeArchiveUrl: string | null;
  installDir: string | null;
  downloadCacheDir: string | null;
  version: string | null;
  lastError: string | null;
  attempt: number;
  maxAttempts: number;
  progress: {
    transferredBytes: number;
    totalBytes: number;
    percent: number;
    speedBytesPerSecond: number;
  } | null;
  updatedAt: number | null;
  gpuName: string | null;
  vramGb: number | null;
}

export type DesktopMiniBackendRuntimeStateListener = (
  state: DesktopMiniBackendRuntimeState,
) => void;

// Updater bridge types: single source in @koma/types.
export type {
  UpdaterProvider,
  UpdaterChannel,
  UpdaterStatus,
  UpdaterEventName,
  UpdaterProgress,
  UpdaterState,
  UpdaterEventPayload,
  UpdaterListener,
} from "@shared/desktop-events";
export type { IUpdaterBridge } from "@shared/desktop-api";


export type DiscordProcessingMode = "basic" | "advanced";
export type DiscordActivityPreset =
  | "aio_pipeline_automatic"
  | "aio_pipeline_manual"
  | "translator_mode"
  | "typesetter_mode"
  | "cleaner_redraw_mode"
  | "idle"
  | "workspace_organize_mode"
  | "raw_provider_mode"
  | "proofreader_qc_mode"
  | "stitcher_mode"
  | "splitter_mode"
  | "watermark_mode"
  | "enhance_mode"
  | "chapter_optimizer_mode"
  | "blogger_cdn_mode"
  | "image_upload_mode"
  | "guides_tutorials"
  | "resources_materials"
  | "settings"
  | "rankings"
  | "scanlation_feed"
  | "login_register"
  | "batch_mode";

export interface IDiscordRpcBridge {
  setEnabled: (enabled: boolean) => Promise<boolean>;
  setActivity: (data: unknown) => Promise<void>;
  setPreset: (preset: DiscordActivityPreset, overrides?: Record<string, unknown>) => Promise<void>;
  setCleaning: (fileName: string, mode: DiscordProcessingMode) => Promise<void>;
  setTranslating: (fileName: string, from: string, to: string) => Promise<void>;
  setTyping: (fileName: string) => Promise<void>;
  setRedrawing: (fileName: string) => Promise<void>;
  setDashboard: (userName: string) => Promise<void>;
  setBatchProcessing: (fileCount: number, currentIndex: number, fileName?: string) => Promise<void>;
  setIdle: () => Promise<void>;
  isConnected: () => Promise<boolean>;
  isEnabled: () => Promise<boolean>;
  getPresetAssets: () => Promise<Record<string, string>>;
}

export interface IDesktopFontEntry {
  id: string;
  family: string;
  fileName: string;
  dataUrl: string;
}

export interface IDesktopFontsApiBridge {
  list: () => Promise<{
    system: string[];
    custom: IDesktopFontEntry[];
  }>;
  import: (payload: {
    fileName: string;
    contentBase64: string;
    family?: string;
  }) => Promise<{
    entry: IDesktopFontEntry;
  }>;
}

export interface IDesktopLlmProfile {
  id: string;
  stage: "translation" | "ocr";
  label: string;
  apiBase: string;
  apiKey: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDesktopLlmProfilesApiBridge {
  list: (userId: string) => Promise<{
    profiles: IDesktopLlmProfile[];
    secureStorage: boolean;
  }>;
  save: (userId: string, profile: IDesktopLlmProfile) => Promise<{
    profiles: IDesktopLlmProfile[];
    profile: IDesktopLlmProfile;
    secureStorage: boolean;
  }>;
  remove: (userId: string, profileId: string) => Promise<{
    profiles: IDesktopLlmProfile[];
    secureStorage: boolean;
  }>;
}

export interface IDesktopDiscordWebhookApiBridge {
  send: (payload: {
    url: string;
    body: Record<string, unknown>;
  }) => Promise<{
    ok: boolean;
    status: number;
    error?: string;
  }>;
}

export interface IDesktopBloggerApiBridge {
  loadConfig: () => Promise<{
    config: BloggerConfig;
    secureStorage: boolean;
  }>;
  saveConfig: (config: BloggerConfig) => Promise<{
    config: BloggerConfig;
    secureStorage: boolean;
  }>;
  testConnection: (config?: BloggerConfig) => Promise<BloggerConnectionResult>;
  uploadImages: (payload: BloggerUploadPayload) => Promise<{
    items: BloggerUploadResult[];
    optimizerApplied: boolean;
  }>;
  publishPost: (payload: BloggerPublishPayload) => Promise<BloggerPublishResult>;
}

export interface IDesktopImgurApiBridge {
  loadConfig: () => Promise<{
    config: ImgurConfig;
    secureStorage: boolean;
    rateLimit: ImgurRateLimitStatus;
  }>;
  saveConfig: (config: ImgurConfig) => Promise<{
    config: ImgurConfig;
    secureStorage: boolean;
    rateLimit: ImgurRateLimitStatus;
  }>;
  uploadImages: (payload: ImgurUploadPayload) => Promise<{
    items: ImgurUploadResult[];
    rateLimit: ImgurRateLimitStatus;
  }>;
}

export type DesktopBugReportLogSource = "app" | "user" | "runtime";

export interface IDesktopMachineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IDesktopMachineDisplayMetrics {
  isPrimary: boolean;
  scaleFactor: number;
  rotation: number;
  bounds: IDesktopMachineRect;
  workArea: IDesktopMachineRect;
}

export interface IDesktopMachineScreenMetrics {
  displayCount: number;
  virtualBounds: IDesktopMachineRect;
  primaryDisplay: IDesktopMachineDisplayMetrics;
  displays: IDesktopMachineDisplayMetrics[];
}

export interface IDesktopMachineProfileV1 {
  desktopDeviceId: string;
  desktopMacFingerprint: string;
  platform: string;
  os: string;
  osVersion: string;
  osRelease: string;
  osMachine: string;
  arch: string;
  processorModel: string;
  cpuCount: number;
  cpuFrequencyMHz: number | null;
  totalMemoryBytes: number;
  hyperVEnabled: boolean | null;
  collectedAt: string;
  screenMetrics: IDesktopMachineScreenMetrics;
}

export interface IDesktopMachineProfileSyncStatus {
  lastSyncedAt: string | null;
  lastChangedAt: string | null;
  lastError: string | null;
  profileHash: string | null;
  changedFields: string[];
  lastReason: "register" | "login" | "startup" | "session-refresh" | "periodic" | null;
}

export interface IDesktopBugReportDiagnostics {
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
  machineProfile: IDesktopMachineProfileV1 | null;
  machineProfileSync: IDesktopMachineProfileSyncStatus;
}

export interface IDesktopBugReportAutoLogEntry {
  id: string;
  name: string;
  size: number;
  source: DesktopBugReportLogSource;
}

export interface IDesktopBugReportPrepareResult {
  screenshotDataUrl: string | null;
  autoLogs: IDesktopBugReportAutoLogEntry[];
  diagnostics: IDesktopBugReportDiagnostics;
  ready?: boolean;
  error?: string;
}

export interface IDesktopBugReportAttachmentPayload {
  name: string;
  mimeType?: string;
  size?: number;
  contentBase64: string;
}

export interface IDesktopBugReportSubmitPayload {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  contact?: string;
  screenshotDataUrl?: string | null;
  autoLogIds?: string[];
  attachments?: IDesktopBugReportAttachmentPayload[];
  context?: Record<string, unknown>;
}

export interface IDesktopBugReportSubmitResult {
  ok: boolean;
  status: number;
  screenshotUrl?: string;
  error?: string;
}

export interface IDesktopBugReportApiBridge {
  prepare: () => Promise<IDesktopBugReportPrepareResult>;
  submit: (payload: IDesktopBugReportSubmitPayload) => Promise<IDesktopBugReportSubmitResult>;
}
export interface IDesktopApiBridge {
  auth: {
    config: () => Promise<{
      ok: boolean;
      status: number;
      payload: {
        captchaEnabled?: boolean;
        turnstileSiteKey?: string | null;
        emailDeliveryEnabled?: boolean;
        desktopClientEnforced?: boolean;
        [key: string]: unknown;
      } | null;
    }>;
    session: () => Promise<{
      ok: boolean;
      status: number;
      payload: {
        user?: {
          id: string;
          email: string;
          emailVerified: boolean;
          name?: string;
          locale?: string;
        };
        accessToken?: string;
        error?: string;
        code?: string;
      } | null;
    }>;
    login: (payload: {
      email: string;
      password: string;
      captchaToken?: string;
      rememberMe?: boolean;
      travelToken?: string;
      locale?: string;
    }) => Promise<{
      ok: boolean;
      status: number;
      payload: {
        error?: string;
        code?: string;
        requiresVerification?: boolean;
        retryAfterSeconds?: number;
        verificationHint?: string;
      } | null;
    }>;
    register: (payload: {
      email: string;
      password: string;
      name?: string;
      captchaToken?: string;
      travelToken?: string;
      locale?: string;
      legalAcceptance?: {
        termsAccepted: boolean;
        privacyAccepted: boolean;
        termsVersion: string;
        privacyVersion: string;
        cookiesVersion: string;
        contentVersion: string;
      };
    }) => Promise<{
      ok: boolean;
      status: number;
      payload: {
        error?: string;
        code?: string;
        requiresVerification?: boolean;
        retryAfterSeconds?: number;
        verificationHint?: string;
      } | null;
    }>;
    setTravelToken: (token: string) => Promise<{
      ok: boolean;
      status: number;
      payload: { success?: boolean; error?: string } | null;
    }>;
    confirmEmail: (token: string) => Promise<{
      ok: boolean;
      status: number;
      payload: {
        success?: boolean;
        message?: string;
        error?: string;
        code?: string;
      } | null;
    }>;
    createTravelToken: (payload?: {
      ttlMinutes?: number;
      travelDays?: number;
      deliveryMode?: "copy" | "email";
    }) => Promise<{
      ok: boolean;
      status: number;
      payload: {
        success?: boolean;
        deliveryMode?: "copy" | "email";
        emailSent?: boolean;
        destinationMasked?: string;
        travelToken?: string;
        expiresAt?: string;
        travelDays?: number;
        error?: string;
        code?: string;
      } | null;
    }>;
    verifyEmail: (accessToken: string) => Promise<{
      ok: boolean;
      status: number;
      payload: { error?: string; code?: string } | null;
    }>;
    forgotPassword: (email: string) => Promise<{
      ok: boolean;
      status: number;
      payload: { error?: string; code?: string } | null;
    }>;
    resetPassword: (token: string, password: string) => Promise<{
      ok: boolean;
      status: number;
      payload: { error?: string; code?: string } | null;
    }>;
    signOut: () => Promise<{
      ok: boolean;
      status: number;
      payload: { error?: string; code?: string } | null;
    }>;
  };
  fonts: IDesktopFontsApiBridge;
  llmProfiles: IDesktopLlmProfilesApiBridge;
  blogger: IDesktopBloggerApiBridge;
  imgur: IDesktopImgurApiBridge;
  discordWebhook: IDesktopDiscordWebhookApiBridge;
  bugReport: IDesktopBugReportApiBridge;
}

export type DesktopModelManifestStatus = "installed" | "incomplete";

export interface IDesktopInstalledModelRecord {
  modelId: string;
  version: string;
  installedAt: string;
  checksumSHA256: string;
  status: DesktopModelManifestStatus;
  installedLanguages?: string[];
  origin?: string | null;
  modelDir: string;
  manifestPath: string;
  sizeBytes: number;
}

export interface IDesktopDiskSpaceInfo {
  freeBytes: number;
  totalBytes: number;
  path: string;
}

export interface IDesktopDownloadModelPayload {
  id: string;
  name: string;
  version: string;
  downloadUrl: string;
  checksumSHA256: string;
  expectedDownloadBytes: number;
  requiredDiskBytes: number;
  sourceLanguage?: string;
  installStrategy?: "direct_download" | "backend_managed" | "manual_import";
  runtimeFamily?:
    | "onnx"
    | "onnx_bundle"
    | "enhance_onnx_bundle"
    | "pytorch_checkpoint"
    | "ctranslate2"
    | "transformers_vlm"
    | "transformers_vlm_paddleocr_manga"
    | "managed_runtime";
  backendInstallEndpoint?: string;
}

export type IDesktopModelManagerEvent =
  | {
      type: "queued";
      modelId: string;
      queueLength: number;
    }
  | {
      type: "started";
      modelId: string;
      attempt: number;
    }
  | {
      type: "progress";
      modelId: string;
      bytesDownloaded: number;
      totalBytes: number;
      speedBytesPerSecond: number;
      percent: number;
      attempt: number;
    }
  | {
      type: "verifying";
      modelId: string;
    }
  | {
      type: "completed";
      modelId: string;
      version: string;
      installedAt: string;
    }
  | {
      type: "failed";
      modelId: string;
      message: string;
      attempt: number;
      willRetry: boolean;
    }
  | {
      type: "cancelled";
      modelId: string;
    };

export interface IDesktopModelsBridge {
  listInstalled: () => Promise<IDesktopInstalledModelRecord[]>;
  getDiskSpace: () => Promise<IDesktopDiskSpaceInfo>;
  checkUpdates: (payloads: IDesktopDownloadModelPayload[]) => Promise<Array<{
    modelId: string;
    installedChecksumSHA256: string | null;
    remoteChecksumSHA256: string | null;
    registryVersion: string;
    checked: boolean;
    updateAvailable: boolean;
  }>>;
  download: (payload: IDesktopDownloadModelPayload) => Promise<{ queued: boolean; queueLength: number }>;
  importOnnx: (payload: { id: string; name: string; version: string }) => Promise<IDesktopInstalledModelRecord>;
  cancel: (modelId: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  uninstall: (modelId: string) => Promise<void>;
  on: (listener: (event: IDesktopModelManagerEvent) => void) => void;
  off: (listener: (event: IDesktopModelManagerEvent) => void) => void;
}

export interface IDesktopWorkspaceBridge {
  loadAutosave: (userId?: string | null) => Promise<WorkspaceAutosaveLoadResult>;
  saveAutosave: (payload: WorkspaceAutosaveSavePayload) => Promise<{ saved: true; path: string }>;
  clearAutosave: (payload?: { userId?: string | null }) => Promise<WorkspaceAutosaveClearResult>;
  exportCurrent: (payload: WorkspaceExportPayload) => Promise<WorkspaceExportResult>;
  importFile: () => Promise<WorkspaceImportResult>;
}

export interface IDesktopLocaleBridge {
  getPreferences: () => Promise<{
    appLocale: string;
    systemLocales: string[];
  }>;
}

export interface IDesktopBridge {
  getRuntimeConfig: () => DesktopRuntimeConfig;
  getMiniBackendRuntimeState: () => Promise<DesktopMiniBackendRuntimeState>;
  listMiniBackendRuntimeArtifacts: () => Promise<DesktopMiniBackendRuntimeArtifactOption[]>;
  installRecommendedMiniBackendRuntime: () => Promise<DesktopMiniBackendRuntimeInstallResult>;
  installMiniBackendRuntimeProfile: (profile: string) => Promise<DesktopMiniBackendRuntimeInstallResult>;
  resetLocalSettings: () => Promise<{
    cleared: true;
    userDataPath: string;
    clearedPaths: string[];
  }>;
  restartApp: () => Promise<{ restarting: true }>;
  onMiniBackendRuntimeState: (listener: DesktopMiniBackendRuntimeStateListener) => void;
  offMiniBackendRuntimeState: (listener: DesktopMiniBackendRuntimeStateListener) => void;
  checkLocalBackend: () => Promise<boolean>;
  restartLocalBackend: () => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
  openCommunityLink: (url: string) => Promise<void>;
  locale?: IDesktopLocaleBridge;
  api?: IDesktopApiBridge;
  models?: IDesktopModelsBridge;
  workspace?: IDesktopWorkspaceBridge;
  discordRPC: IDiscordRpcBridge;
}

export type OptimizationPreset = "web-light" | "reading" | "archive" | "social" | "custom";
export type RawOutputFormat = "png" | "jpeg" | "webp";

export interface OptimizationRecipe {
  preset: OptimizationPreset;
  outputFormat: RawOutputFormat;
  quality: number;
  resizeEnabled: boolean;
  maxWidth: number;
  maxHeight: number;
  trimBorders: boolean;
  trimTolerance: number;
  sharpen: boolean;
  sharpenStrength: number;
  grayscale: boolean;
  autoLevels: boolean;
  brightness: number;
  contrast: number;
  noiseReduction: boolean;
  noiseReductionStrength: number;
  rotation: 0 | 90 | 180 | 270;
  renamePattern: string;
}

export interface OptimizationResult {
  sourceImageId: string;
  fileName: string;
  blob: Blob;
  previewUrl?: string;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

export type {
  BloggerConfig,
  BloggerConnectionResult,
  BloggerOptimizerConfig,
  BloggerPreprocessConfig,
  BloggerPreprocessFormat,
  BloggerPublishPayload,
  BloggerPublishResult,
  BloggerUploadItemInput,
  BloggerUploadPayload,
  BloggerUploadResult,
} from "../../../../packages/types/src/blogger";

export {
  DEFAULT_BLOGGER_CONFIG,
  DEFAULT_BLOGGER_OPTIMIZER_CONFIG,
  DEFAULT_BLOGGER_PREPROCESS_CONFIG,
  normalizeBloggerConfig,
} from "../../../../packages/types/src/blogger";

export type {
  ImgurConfig,
  ImgurRateLimitStatus,
  ImgurUploadItemInput,
  ImgurUploadPayload,
  ImgurUploadResult,
} from "../../../../packages/types/src/imgur";

export {
  DEFAULT_IMGUR_CONFIG,
  calculateImgurRateLimitStatus,
  normalizeImgurConfig,
} from "../../../../packages/types/src/imgur";
