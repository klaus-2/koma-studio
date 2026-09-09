/// <reference types="node" />
import fs from "node:fs";
import path from "node:path";
import { loadRuntimeConfig } from "./runtime-config-loader.ts";

type ProcessingMode = "basic" | "advanced";

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

const DISCORD_ACTIVITY_TYPE_PLAYING = 0;

export interface DiscordButton {
  label: string;
  url: string;
}

export interface DiscordActivityDetails {
  type?: number;
  state?: string;
  details?: string;
  instance?: boolean;
  startTimestamp?: number;
  endTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  buttons?: DiscordButton[];
}

interface DiscordRpcClient {
  user?: { username?: string };
  isReady?: boolean;
  connectionState?: string;
  on(event: string, handler: (...args: unknown[]) => void): void;
  login(payload: { clientId: string }): Promise<unknown>;
  setActivity(activity: unknown): Promise<unknown>;
  clearActivity?(): Promise<unknown> | void;
  destroy?(): void;
}

interface DiscordRpcModule {
  Client: new (options?: Record<string, unknown>) => DiscordRpcClient;
  register?: (clientId: string) => void;
  ActivityType?: {
    Playing?: number;
    Streaming?: number;
    Listening?: number;
    Watching?: number;
    Competing?: number;
  };
}

const RPC_MODULE_CANDIDATES = [
  "@nich87/discord-rpc",
  "@ryuziii/discord-rpc",
  "discord-rpc-new",
  "discord-rpc",
] as const;

type RpcFlavor = "nich87" | "legacy";

interface DiscordRuntimeConfig {
  [key: string]: string;
}

interface Nich87ActivityPayload {
  type?: number;
  details?: string;
  state?: string;
  instance?: boolean;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  buttons?: DiscordButton[];
}

const MAX_BUTTONS = 2;
const MAX_TEXT_LENGTH = 128;
const MIN_ACTIVITY_UPDATE_INTERVAL_MS = 250;
const DEFAULT_DISCORD_CLIENT_ID = "1484952540775977061";

const DEFAULT_KOMA_WEBSITE_URL = "https://koma-studio.site";
const DEFAULT_KOMA_DOWNLOAD_URL = "https://koma-studio.site/download/windows";

const DISCORD_ACTIVITY_PRESETS: Record<DiscordActivityPreset, {
  details: string;
  state: string;
  largeImageKey: string;
  largeImageText: string;
  smallImageKey: string;
  smallImageText: string;
}> = {
  aio_pipeline_automatic: {
    details: "AIO Pipeline",
    state: "Automatic Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "aio_pipeline_automatic",
    smallImageText: "AIO Pipeline Automatic Mode",
  },
  aio_pipeline_manual: {
    details: "AIO Pipeline",
    state: "Manual Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "aio_pipeline_manual",
    smallImageText: "AIO Pipeline Manual Mode",
  },
  translator_mode: {
    details: "Translation Workspace",
    state: "Translator Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "translator_mode",
    smallImageText: "Translator Mode",
  },
  typesetter_mode: {
    details: "Typesetting Workspace",
    state: "Typesetter Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "typesetter_mode",
    smallImageText: "Typesetter Mode",
  },
  cleaner_redraw_mode: {
    details: "Art Cleanup",
    state: "Cleaner / Redraw Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "cleaner_redraw_mode",
    smallImageText: "Cleaner / Redraw Mode",
  },
  idle: {
    details: "KŌMA Studio",
    state: "Idle",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "idle",
    smallImageText: "Idle",
  },
  workspace_organize_mode: {
    details: "Workspace",
    state: "Organize Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "workspace_organize_mode",
    smallImageText: "Workspace / Organize Mode",
  },
  raw_provider_mode: {
    details: "Provider Console",
    state: "Raw Provider Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "raw_provider_mode",
    smallImageText: "Raw Provider Mode",
  },
  proofreader_qc_mode: {
    details: "Review Workspace",
    state: "Proofreader / QC Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "proofreader_qc_mode",
    smallImageText: "Proofreader / QC Mode",
  },
  stitcher_mode: {
    details: "Page Stitching",
    state: "Stitcher Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "stitcher_mode",
    smallImageText: "Stitcher Mode",
  },
  splitter_mode: {
    details: "Page Splitting",
    state: "Splitter Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "splitter_mode",
    smallImageText: "Splitter Mode",
  },
  watermark_mode: {
    details: "Branding Tools",
    state: "Watermark Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "watermark_mode",
    smallImageText: "Watermark Mode",
  },
  enhance_mode: {
    details: "Image Enhancement",
    state: "Enhance Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "enhance_mode",
    smallImageText: "Enhance Mode",
  },
  chapter_optimizer_mode: {
    details: "Release Optimization",
    state: "Chapter Optimizer Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "chapter_optimizer_mode",
    smallImageText: "Chapter Optimizer Mode",
  },
  blogger_cdn_mode: {
    details: "Distribution Tools",
    state: "Blogger CDN Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "blogger_cdn_mode",
    smallImageText: "Blogger CDN Mode",
  },
  image_upload_mode: {
    details: "Distribution Tools",
    state: "Image Upload Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "image_upload_mode",
    smallImageText: "Image Upload Mode",
  },
  guides_tutorials: {
    details: "Help Center",
    state: "Guides & Tutorials",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "guides_tutorials",
    smallImageText: "Guides & Tutorials",
  },
  resources_materials: {
    details: "Help Center",
    state: "Resources & Materials",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "resources_materials",
    smallImageText: "Resources & Materials",
  },
  settings: {
    details: "Preferences",
    state: "Settings",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "settings",
    smallImageText: "Settings",
  },
  rankings: {
    details: "Model Leaderboards",
    state: "Rankings",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "rankings",
    smallImageText: "Rankings",
  },
  scanlation_feed: {
    details: "Community",
    state: "Scanlation Feed",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "scanlation_feed",
    smallImageText: "Scanlation Feed",
  },
  login_register: {
    details: "Account Access",
    state: "Login / Register",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "login_register",
    smallImageText: "Login / Register",
  },
  batch_mode: {
    details: "Batch Processing",
    state: "Batch Mode",
    largeImageKey: "koma_logo",
    largeImageText: "KŌMA Studio",
    smallImageKey: "batch_mode",
    smallImageText: "Batch Mode",
  },
};

const RUNTIME_CONFIG_DIR_CANDIDATES = [
  path.resolve(process.cwd(), "dist-electron"),
  path.resolve(process.cwd()),
  typeof process.resourcesPath === "string" && process.resourcesPath.length > 0
    ? path.resolve(process.resourcesPath, "app.asar", "dist-electron")
    : null,
  typeof process.resourcesPath === "string" && process.resourcesPath.length > 0
    ? path.resolve(process.resourcesPath, "dist-electron")
    : null,
].filter((value): value is string => Boolean(value));

let cachedDiscordRuntimeConfig: DiscordRuntimeConfig | null | undefined;

const APP_START_TIMESTAMP = Date.now();

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getErrorCode = (error: unknown): number | string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  return (error as { code?: number | string }).code;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error ?? "");
};

const isTerminatedRpcRequestError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  if (code === 1000 || code === "1000") {
    return true;
  }

  return getErrorMessage(error).toLowerCase().includes("request has been terminated");
};

const toEnvValue = (raw: string | undefined): string | null => {
  if (!raw) {
    return null;
  }

  const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
  return cleaned.length > 0 ? cleaned : null;
};

const readClientIdFromEnvFile = (filePath: string): string | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();

      if (
        key === "DISCORD_RPC_CLIENT_ID" ||
        key === "DISCORD_CLIENT_ID" ||
        key === "VITE_DISCORD_CLIENT_ID"
      ) {
        return toEnvValue(rawValue);
      }
    }
  } catch {
    // ignore malformed/locked files
  }

  return null;
};

const resolveDiscordRuntimeConfig = (): DiscordRuntimeConfig | null => {
  if (cachedDiscordRuntimeConfig !== undefined) {
    return cachedDiscordRuntimeConfig;
  }

  for (const configDir of RUNTIME_CONFIG_DIR_CANDIDATES) {
    try {
      const parsed = loadRuntimeConfig(configDir);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        cachedDiscordRuntimeConfig = parsed;
        return cachedDiscordRuntimeConfig;
      }
    } catch {
      // try next config dir
    }
  }

  cachedDiscordRuntimeConfig = null;
  return null;
};

const resolveRuntimeConfigValue = (key: string): string | null => {
  const config = resolveDiscordRuntimeConfig();
  const value = config?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const resolveDesktopConfigValue = (key: string): string | null => {
  const fromProcess = toEnvValue(process.env[key]);
  if (fromProcess) {
    return fromProcess;
  }

  const fromRuntimeConfig = resolveRuntimeConfigValue(key);
  if (fromRuntimeConfig) {
    return fromRuntimeConfig;
  }

  const cwd = process.cwd();
  const envMode = (process.env.NODE_ENV ?? "").toLowerCase() === "production"
    ? "production"
    : "development";
  const envCandidates = [
    path.join(cwd, `.env.${envMode}.local`),
    path.join(cwd, `.env.${envMode}`),
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
  ];

  for (const envFile of envCandidates) {
    const value = readClientIdFromEnvFile(envFile);
    if (value) {
      return key === "DISCORD_RPC_CLIENT_ID" || key === "DISCORD_CLIENT_ID" || key === "VITE_DISCORD_CLIENT_ID"
        ? value
        : readValueFromEnvFile(envFile, key);
    }
    const otherValue = readValueFromEnvFile(envFile, key);
    if (otherValue) {
      return otherValue;
    }
  }

  return null;
};

const readValueFromEnvFile = (filePath: string, key: string): string | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) {
        continue;
      }
      const separatorIndex = line.indexOf("=");
      const parsedKey = line.slice(0, separatorIndex).trim();
      if (parsedKey !== key) {
        continue;
      }
      return toEnvValue(line.slice(separatorIndex + 1).trim());
    }
  } catch {
    return null;
  }

  return null;
};

const resolveDiscordClientId = (): string | null => {
  const fromProcess =
    resolveDesktopConfigValue("DISCORD_RPC_CLIENT_ID") ??
    resolveDesktopConfigValue("DISCORD_CLIENT_ID") ??
    resolveDesktopConfigValue("VITE_DISCORD_CLIENT_ID");

  if (fromProcess) {
    return fromProcess;
  }

  const cwd = process.cwd();
  const envMode = (process.env.NODE_ENV ?? "").toLowerCase() === "production"
    ? "production"
    : "development";
  const envCandidates = [
    path.join(cwd, `.env.${envMode}`),
    path.join(cwd, ".env"),
    path.join(cwd, ".env.production"),
    path.join(cwd, ".env.development"),
  ];

  for (const envFile of envCandidates) {
    const value = readClientIdFromEnvFile(envFile);
    if (value) {
      return value;
    }
  }

  return DEFAULT_DISCORD_CLIENT_ID;
};

const KOMA_WEBSITE_URL =
  resolveDesktopConfigValue("KOMA_STUDIO_URL") ??
  resolveDesktopConfigValue("VITE_PROJECT_WEBSITE_URL") ??
  DEFAULT_KOMA_WEBSITE_URL;

const KOMA_DOWNLOAD_URL =
  resolveDesktopConfigValue("KOMA_STUDIO_DOWNLOAD_URL") ??
  DEFAULT_KOMA_DOWNLOAD_URL;

const DEFAULT_BUTTONS: DiscordButton[] = [
  { label: "Website", url: KOMA_WEBSITE_URL },
  { label: "Download", url: KOMA_DOWNLOAD_URL },
];

const normalizeMode = (mode: string): ProcessingMode =>
  mode === "advanced" ? "advanced" : "basic";

const toSafeText = (value: string | undefined, maxLength = MAX_TEXT_LENGTH): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
};

const toValidButtons = (buttons: DiscordButton[] | undefined): DiscordButton[] | undefined => {
  if (!buttons || buttons.length === 0) {
    return undefined;
  }

  const cleaned = buttons
    .slice(0, MAX_BUTTONS)
    .filter((button) => {
      try {
        const parsed = new URL(button.url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    })
    .map((button) => ({
      label: toSafeText(button.label, 32) ?? "Abrir",
      url: button.url,
    }));

  return cleaned.length > 0 ? cleaned : undefined;
};

const sanitizeActivity = (activity: DiscordActivityDetails): DiscordActivityDetails => ({
  type: activity.type ?? DISCORD_ACTIVITY_TYPE_PLAYING,
  details: toSafeText(activity.details),
  state: toSafeText(activity.state),
  instance: activity.instance ?? true,
  startTimestamp: activity.startTimestamp,
  endTimestamp: activity.endTimestamp,
  largeImageKey: toSafeText(activity.largeImageKey, 64),
  largeImageText: toSafeText(activity.largeImageText),
  smallImageKey: toSafeText(activity.smallImageKey, 64),
  smallImageText: toSafeText(activity.smallImageText),
  buttons: toValidButtons(activity.buttons),
});

const toNich87ActivityPayload = (activity: DiscordActivityDetails): Nich87ActivityPayload => {
  const payload: Nich87ActivityPayload = {
    type: activity.type,
    details: activity.details,
    state: activity.state,
    instance: activity.instance,
    buttons: activity.buttons,
  };

  if (activity.startTimestamp || activity.endTimestamp) {
    payload.timestamps = {
      start: activity.startTimestamp,
      end: activity.endTimestamp,
    };
  }

  if (activity.largeImageKey || activity.largeImageText || activity.smallImageKey || activity.smallImageText) {
    payload.assets = {
      large_image: activity.largeImageKey,
      large_text: activity.largeImageText,
      small_image: activity.smallImageKey,
      small_text: activity.smallImageText,
    };
  }

  return payload;
};

const truncateFileName = (fileName: string, maxLength = 48): string => {
  const value = fileName.trim();
  if (value.length <= maxLength) {
    return value;
  }

  const dotIndex = value.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === value.length - 1) {
    return `${value.slice(0, maxLength - 3)}...`;
  }

  const ext = value.slice(dotIndex);
  const base = value.slice(0, dotIndex);
  const baseLimit = Math.max(8, maxLength - ext.length - 1);

  return `${base.slice(0, baseLimit)}...${ext}`;
};

const parseRpcModule = (loaded: unknown): DiscordRpcModule | null => {
  if (!loaded || typeof loaded !== "object") {
    return null;
  }

  const candidate = (loaded as { default?: unknown }).default ?? loaded;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const moduleCandidate = candidate as Partial<DiscordRpcModule>;
  if (typeof moduleCandidate.Client !== "function") {
    return null;
  }

  return moduleCandidate as DiscordRpcModule;
};

export class DiscordRPCService {
  private clientId: string | null = null;
  private client: DiscordRpcClient | null = null;
  private rpcModule: DiscordRpcModule | null = null;
  private connected = false;
  private rpcFlavor: RpcFlavor = "legacy";
  private enabled = true;
  private connectingPromise: Promise<boolean> | null = null;
  private hasWarnedMissingClientId = false;
  private lastActivityFingerprint: string | null = null;
  private lastActivityAt = 0;
  private currentActivity: DiscordActivityDetails | null = null;
  private pendingActivity: DiscordActivityDetails | null = null;
  private activityFlushPromise: Promise<void> | null = null;

  getPresetAssetMap(): Record<DiscordActivityPreset, string> {
    return Object.fromEntries(
      Object.entries(DISCORD_ACTIVITY_PRESETS).map(([key, value]) => [key, value.smallImageKey]),
    ) as Record<DiscordActivityPreset, string>;
  }

  private isClientReady(): boolean {
    if (!this.client) {
      return false;
    }

    if (this.rpcFlavor === "nich87") {
      if (this.client.isReady === true) {
        return true;
      }

      return this.client.connectionState === "ready";
    }

    return this.connected;
  }

  private async waitUntilClientReady(timeoutMs = 2_000): Promise<boolean> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (this.isClientReady()) {
        return true;
      }

      await wait(50);
    }

    return this.isClientReady();
  }

  async connectWithRetry(maxRetries = 3, delayMs = 2_000): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const connected = await this.connect();
      if (connected) {
        return true;
      }

      if (attempt < maxRetries) {
        await wait(delayMs);
      }
    }

    return this.connected;
  }

  async connect(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    if (this.connected) {
      return true;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = this.connectInternal().finally(() => {
      this.connectingPromise = null;
    });

    return this.connectingPromise;
  }

  private async connectInternal(): Promise<boolean> {
    this.clientId = resolveDiscordClientId();

    if (!this.clientId) {
      if (!this.hasWarnedMissingClientId) {
        console.warn(
          "Discord Rich Presence desativado: configure DISCORD_RPC_CLIENT_ID (ou DISCORD_CLIENT_ID).",
        );
        this.hasWarnedMissingClientId = true;
      }
      return false;
    }

    if (!this.rpcModule) {
      this.rpcModule = await this.loadRpcModule();
      if (!this.rpcModule) {
        return false;
      }
    }

    try {
      if (this.client) {
        this.safeDestroyClient();
      }

      this.rpcModule.register?.(this.clientId);

      this.client =
        this.rpcFlavor === "nich87"
          ? new this.rpcModule.Client()
          : new this.rpcModule.Client({ transport: "ipc" });
      this.attachClientListeners(this.client);

      await this.client.login({ clientId: this.clientId });
      this.connected = true;
      this.lastActivityFingerprint = null;
      this.lastActivityAt = 0;


      const ready = await this.waitUntilClientReady();
      if (!ready) {
        console.warn("Discord RPC: client connected, but not ready for activity yet.");
      } else if (this.currentActivity) {
        await this.setActivityInternal(this.currentActivity);
      }

      return true;
    } catch (error) {
      this.connected = false;
      this.safeDestroyClient();
      console.warn("Discord RPC: failed to connect.", error);
      return false;
    }
  }

  private async loadRpcModule(): Promise<DiscordRpcModule | null> {
    for (const moduleName of RPC_MODULE_CANDIDATES) {
      try {
        const loaded = await import(moduleName);
        const parsed = parseRpcModule(loaded);
        if (parsed) {
          this.rpcFlavor = moduleName === "@nich87/discord-rpc" ? "nich87" : "legacy";
          return parsed;
        }
      } catch {
        // try next module
      }
    }

    console.warn(
      "Discord RPC: no library found. Install one of the supported options (e.g. @ryuziii/discord-rpc).",
    );
    return null;
  }

  private attachClientListeners(client: DiscordRpcClient): void {
    client.on("ready", () => {
      // Some clients emit 'ready' before they are fully request-ready.
      // Activity is set only after login() resolves and isClientReady() passes.
    });

    client.on("disconnected", () => {
      this.connected = false;
    });

    client.on("error", (error) => {
      this.connected = false;
      console.warn("Discord RPC error:", error);
    });
  }

  async disconnect(): Promise<void> {
    this.currentActivity = null;
    this.lastActivityFingerprint = null;
    this.lastActivityAt = 0;
    this.connected = false;

    this.safeDestroyClient();
  }

  private safeDestroyClient(): void {
    if (!this.client) {
      return;
    }

    try {
      this.client.clearActivity?.();
    } catch {
      // ignore
    }

    try {
      this.client.destroy?.();
    } catch {
      // ignore
    }

    this.client = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async clearActivity(): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }
    try {
      this.client.clearActivity?.();
    } catch {
      // best effort — a clear failure must never take the app down
    }
  }

  async setEnabled(enabled: boolean): Promise<boolean> {
    this.enabled = enabled;

    if (!enabled) {
      await this.disconnect();
      return false;
    }

    return this.connectWithRetry();
  }

  async setActivity(activity: DiscordActivityDetails): Promise<void> {
    this.pendingActivity = activity;
    await this.flushPendingActivity();
  }

  private async flushPendingActivity(): Promise<void> {
    if (this.activityFlushPromise) {
      await this.activityFlushPromise;
      return;
    }

    this.activityFlushPromise = (async () => {
      try {
        while (this.pendingActivity) {
          const nextActivity = this.pendingActivity;
          this.pendingActivity = null;
          await this.setActivityInternal(nextActivity);
        }
      } finally {
        this.activityFlushPromise = null;
      }
    })();

    await this.activityFlushPromise;
  }

  private async setActivityInternal(activity: DiscordActivityDetails): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const connected = this.connected || (await this.connectWithRetry());
    if (!connected || !this.client) {
      return;
    }

    const ready = await this.waitUntilClientReady();
    if (!ready) {
      console.warn("Discord RPC: activity skipped because the client did not become ready in time.");
      return;
    }

    const sanitized = sanitizeActivity(activity);
    // Dedup must be based on a plain serializable shape.
    // PresenceBuilder payloads may not stringify deterministically across RPC libs.
    const fingerprint = JSON.stringify(sanitized);
      const payload = this.rpcFlavor === "nich87"
        ? toNich87ActivityPayload(sanitized)
        : sanitized;

    if (fingerprint === this.lastActivityFingerprint) {
      return;
    }

    const elapsed = Date.now() - this.lastActivityAt;
    if (elapsed < MIN_ACTIVITY_UPDATE_INTERVAL_MS) {
      await wait(MIN_ACTIVITY_UPDATE_INTERVAL_MS - elapsed);
    }

    if (!this.connected || !this.client) {
      return;
    }

    try {
      await this.client.setActivity(payload);
      this.currentActivity = sanitized;
      this.lastActivityFingerprint = fingerprint;
      this.lastActivityAt = Date.now();
    } catch (error) {
      if (isTerminatedRpcRequestError(error)) {
        this.connected = false;
        this.safeDestroyClient();
        console.warn(
          "Discord RPC: activity discarded because the connection was closed during the update.",
        );
        return;
      }

      console.warn("Discord RPC: failed to update activity.", error);
    }
  }

  async setIdleActivity(): Promise<void> {
    await this.setPresetActivity("idle", {
      startTimestamp: APP_START_TIMESTAMP,
    });
  }

  async setPresetActivity(
    preset: DiscordActivityPreset,
    overrides: Partial<DiscordActivityDetails> = {},
  ): Promise<void> {
    const base = DISCORD_ACTIVITY_PRESETS[preset];
    await this.setActivity({
      type: DISCORD_ACTIVITY_TYPE_PLAYING,
      instance: true,
      details: base.details,
      state: base.state,
      largeImageKey: base.largeImageKey,
      largeImageText: base.largeImageText,
      smallImageKey: base.smallImageKey,
      smallImageText: base.smallImageText,
      buttons: DEFAULT_BUTTONS,
      ...overrides,
    });
  }

  async setDashboardActivity(userName: string): Promise<void> {
    await this.setPresetActivity("workspace_organize_mode", {
      details: "In the Workspace",
      state: toSafeText(userName, 32) ?? "User",
      startTimestamp: APP_START_TIMESTAMP,
    });
  }

  async setCleaningActivity(fileName: string, mode: string): Promise<void> {
    const normalizedMode = normalizeMode(mode);
    const modeLabel = normalizedMode === "advanced" ? "Advanced" : "Basic";

    await this.setPresetActivity("cleaner_redraw_mode", {
      details: `Limpando imagem - ${truncateFileName(fileName)}`,
      state: `Modo: ${modeLabel}`,
      startTimestamp: Date.now(),
    });
  }

  async setTranslatingActivity(fileName: string, fromLang: string, toLang: string): Promise<void> {
    await this.setPresetActivity("translator_mode", {
      details: `Traduzindo - ${truncateFileName(fileName)}`,
      state: `${toSafeText(fromLang, 12) ?? "?"} -> ${toSafeText(toLang, 12) ?? "?"}`,
      startTimestamp: Date.now(),
    });
  }

  async setTypingActivity(fileName: string): Promise<void> {
    await this.setPresetActivity("typesetter_mode", {
      details: `Editando texto - ${truncateFileName(fileName)}`,
      state: "Typesetting",
      startTimestamp: Date.now(),
    });
  }

  async setRedrawingActivity(fileName: string): Promise<void> {
    await this.setPresetActivity("cleaner_redraw_mode", {
      details: `Redesenhando - ${truncateFileName(fileName)}`,
      state: "Redraw Tool",
      startTimestamp: Date.now(),
    });
  }

  async setBatchProcessingActivity(
    fileCount: number,
    currentIndex: number,
    currentFile?: string,
  ): Promise<void> {
    const safeFileCount = Math.max(1, fileCount);
    const safeCurrentIndex = Math.min(Math.max(currentIndex, 1), safeFileCount);
    const details = currentFile
      ? `Processando lote - ${truncateFileName(currentFile)}`
      : "Processando lote";

    await this.setPresetActivity("batch_mode", {
      details,
      state: `${safeCurrentIndex}/${safeFileCount} files`,
      startTimestamp: Date.now(),
    });
  }
}

export const discordRPC = new DiscordRPCService();
