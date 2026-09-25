import { contextBridge, ipcRenderer } from "electron";

type UpdaterEventName =
  | "status"
  | "checking"
  | "available"
  | "not-available"
  | "progress"
  | "downloaded"
  | "error";

type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdaterProgressPayload {
  percent: number;
  transferred: number;
  total: number;
  speed: number;
}

interface UpdaterStatusPayload {
  status: UpdaterStatus;
  currentVersion: string;
  newVersion: string | null;
  mandatory: boolean;
  blocking: boolean;
  blockingReason: "mandatory-update" | null;
  releaseNotes: string | null;
  channel: "stable" | "beta";
  provider: "github" | "generic";
  autoInstallOnQuit: boolean;
  allowPrerelease: boolean;
  progress: UpdaterProgressPayload | null;
  checkedAt: number | null;
  downloadedAt: number | null;
  error: string | null;
}

interface UpdaterEventPayload {
  event: UpdaterEventName;
  state: UpdaterStatusPayload;
}

type UpdaterListener = (payload: UpdaterEventPayload) => void;

type ModelManagerEvent =
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
      code?: string;
    }
  | {
      type: "cancelled";
      modelId: string;
    };

type ModelManagerListener = (event: ModelManagerEvent) => void;

type MiniBackendRuntimeStatus =
  | "idle"
  | "resolving"
  | "checking"
  | "downloading"
  | "verifying"
  | "extracting"
  | "ready"
  | "fallback"
  | "error";

interface MiniBackendRuntimeProgressPayload {
  transferredBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSecond: number;
}

interface MiniBackendRuntimeStatePayload {
  status: MiniBackendRuntimeStatus;
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
  progress: MiniBackendRuntimeProgressPayload | null;
  updatedAt: number | null;
  gpuName: string | null;
  vramGb: number | null;
}

type MiniBackendRuntimeListener = (state: MiniBackendRuntimeStatePayload) => void;

interface MiniBackendRuntimeArtifactOptionPayload {
  profile: string;
  version: string;
  size: number;
  installed: boolean;
  recommended: boolean;
}

type RuntimeConfig = {
  authApiUrl: string;
  localApiUrl: string;
  runtimeArtifactsUrl?: string;
  appPackaged: boolean;
  authDisabled: boolean;
};

const fallbackRuntimeConfig: RuntimeConfig = {
  authApiUrl: process.env.VITE_AUTH_API_URL ?? "http://localhost:3001",
  localApiUrl: process.env.VITE_LOCAL_API_URL ?? "http://127.0.0.1:8001",
  appPackaged: false,
  authDisabled: ["true", "1", "yes"].includes((process.env.VITE_AUTH_DISABLED ?? "").trim().toLowerCase()),
};
const RENDERER_SESSION_LOG_CHANNEL = "desktop:session-log";
const DESKTOP_SHORTCUT_ACTION_CHANNEL = "desktop:shortcut-action";

const stringifyRendererLogArg = (value: unknown): string => {
  if (value instanceof Error) {
    return value.stack || value.message || value.name;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value ?? "");
};

const emitRendererSessionLog = (
  level: "log" | "info" | "warn" | "error" | "debug",
  args: unknown[],
): void => {
  try {
    const message = args.map((item) => stringifyRendererLogArg(item)).join(" ").trim();
    if (!message) {
      return;
    }
    ipcRenderer.send(RENDERER_SESSION_LOG_CHANNEL, {
      level,
      source: "renderer",
      message,
    });
  } catch {
    // no-op
  }
};

const readRuntimeConfig = (): RuntimeConfig => {
  const rawConfig = ipcRenderer.sendSync("desktop:get-runtime-config") as
      | {
          authApiUrl?: string;
          localApiUrl?: string;
          runtimeArtifactsUrl?: string;
          appPackaged?: boolean;
          authDisabled?: boolean;
        }
    | null;

  return {
    authApiUrl: rawConfig?.authApiUrl ?? fallbackRuntimeConfig.authApiUrl,
    localApiUrl: rawConfig?.localApiUrl ?? fallbackRuntimeConfig.localApiUrl,
    runtimeArtifactsUrl: rawConfig?.runtimeArtifactsUrl,
    appPackaged: rawConfig?.appPackaged ?? fallbackRuntimeConfig.appPackaged,
    authDisabled: rawConfig?.authDisabled ?? fallbackRuntimeConfig.authDisabled,
  };
};

const createSecureNonce = (): string => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const invokeSecureDesktopApi = (channel: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
  ipcRenderer.invoke(channel, {
    ...payload,
    __ipcMeta: {
      nonce: createSecureNonce(),
      timestampMs: Date.now(),
    },
  });

const updaterEventNames: UpdaterEventName[] = [
  "status",
  "checking",
  "available",
  "not-available",
  "progress",
  "downloaded",
  "error",
];
const updaterListeners = new Map<UpdaterEventName, Set<UpdaterListener>>();
for (const eventName of updaterEventNames) {
  updaterListeners.set(eventName, new Set<UpdaterListener>());
}

const asUpdaterEventName = (value: unknown): UpdaterEventName | null => {
  if (typeof value !== "string") {
    return null;
  }

  return updaterEventNames.includes(value as UpdaterEventName) ? (value as UpdaterEventName) : null;
};

const asUpdaterState = (value: unknown): UpdaterStatusPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const status =
    typeof payload.status === "string"
      ? (payload.status as UpdaterStatus)
      : null;
  if (!status) {
    return null;
  }

  return {
    status,
    currentVersion: typeof payload.currentVersion === "string" ? payload.currentVersion : "0.0.0",
    newVersion: typeof payload.newVersion === "string" ? payload.newVersion : null,
    mandatory: payload.mandatory === true,
    blocking: payload.blocking === true,
    blockingReason: payload.blockingReason === "mandatory-update" ? "mandatory-update" : null,
    releaseNotes: typeof payload.releaseNotes === "string" ? payload.releaseNotes : null,
    channel: payload.channel === "beta" ? "beta" : "stable",
    provider: payload.provider === "generic" ? "generic" : "github",
    autoInstallOnQuit: payload.autoInstallOnQuit === true,
    allowPrerelease: payload.allowPrerelease === true,
    progress:
      payload.progress && typeof payload.progress === "object"
        ? {
            percent: Number((payload.progress as Record<string, unknown>).percent ?? 0),
            transferred: Number((payload.progress as Record<string, unknown>).transferred ?? 0),
            total: Number((payload.progress as Record<string, unknown>).total ?? 0),
            speed: Number((payload.progress as Record<string, unknown>).speed ?? 0),
          }
        : null,
    checkedAt: typeof payload.checkedAt === "number" ? payload.checkedAt : null,
    downloadedAt: typeof payload.downloadedAt === "number" ? payload.downloadedAt : null,
    error: typeof payload.error === "string" ? payload.error : null,
  };
};

const invokeUpdaterState = async (
  channel: string,
  payload?: unknown,
): Promise<UpdaterStatusPayload> => {
  const rawState =
    payload === undefined ? await ipcRenderer.invoke(channel) : await ipcRenderer.invoke(channel, payload);
  const normalized = asUpdaterState(rawState);
  if (!normalized) {
    throw new Error(`Updater bridge returned invalid state for ${channel}.`);
  }

  return normalized;
};

const notifyUpdaterListeners = (eventName: UpdaterEventName, payload: UpdaterEventPayload): void => {
  const listeners = updaterListeners.get(eventName);
  if (!listeners || listeners.size === 0) {
    return;
  }

  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // Listener failures should not break preload event dispatch.
    }
  });
};

ipcRenderer.on("updater:event", (_event, rawPayload: unknown) => {
  if (!rawPayload || typeof rawPayload !== "object") {
    return;
  }

  const payload = rawPayload as Record<string, unknown>;
  const eventName = asUpdaterEventName(payload.event);
  const state = asUpdaterState(payload.state);
  if (!eventName || !state) {
    return;
  }

  const normalizedPayload: UpdaterEventPayload = {
    event: eventName,
    state,
  };

  notifyUpdaterListeners(eventName, normalizedPayload);
  if (eventName !== "status") {
    notifyUpdaterListeners("status", normalizedPayload);
  }
});

const addUpdaterListener = (eventName: UpdaterEventName, listener: UpdaterListener): void => {
  const bucket = updaterListeners.get(eventName);
  if (!bucket) {
    return;
  }

  bucket.add(listener);
};

const removeUpdaterListener = (eventName: UpdaterEventName, listener: UpdaterListener): void => {
  const bucket = updaterListeners.get(eventName);
  if (!bucket) {
    return;
  }

  bucket.delete(listener);
};

const removeAllUpdaterListeners = (eventName?: UpdaterEventName): void => {
  if (eventName) {
    updaterListeners.get(eventName)?.clear();
    return;
  }

  updaterListeners.forEach((bucket) => bucket.clear());
};

const modelManagerListeners = new Set<ModelManagerListener>();

const miniBackendRuntimeListeners = new Set<MiniBackendRuntimeListener>();

const notifyModelManagerListeners = (event: ModelManagerEvent): void => {
  modelManagerListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Listener errors should not break the event stream.
    }
  });
};

const notifyMiniBackendRuntimeListeners = (state: MiniBackendRuntimeStatePayload): void => {
  miniBackendRuntimeListeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      // Listener errors should not break the event stream.
    }
  });
};

const normalizeMiniBackendRuntimeState = (value: unknown): MiniBackendRuntimeStatePayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const status = typeof payload.status === "string" ? (payload.status as MiniBackendRuntimeStatus) : null;
  if (!status) {
    return null;
  }

  return {
    status,
    statusMessage: typeof payload.statusMessage === "string" ? payload.statusMessage : null,
    requestedProfile: typeof payload.requestedProfile === "string" ? payload.requestedProfile : "cpu",
    activeProfile: typeof payload.activeProfile === "string" ? payload.activeProfile : "cpu",
    source: payload.source === "downloaded-runtime" ? "downloaded-runtime" : "bundled-core",
    runtimeArtifactsUrl: typeof payload.runtimeArtifactsUrl === "string" ? payload.runtimeArtifactsUrl : null,
    runtimeManifestUrl: typeof payload.runtimeManifestUrl === "string" ? payload.runtimeManifestUrl : null,
    runtimeArchiveUrl: typeof payload.runtimeArchiveUrl === "string" ? payload.runtimeArchiveUrl : null,
    installDir: typeof payload.installDir === "string" ? payload.installDir : null,
    downloadCacheDir: typeof payload.downloadCacheDir === "string" ? payload.downloadCacheDir : null,
    version: typeof payload.version === "string" ? payload.version : null,
    lastError: typeof payload.lastError === "string" ? payload.lastError : null,
    attempt: Number(payload.attempt ?? 0),
    maxAttempts: Number(payload.maxAttempts ?? 0),
    progress:
      payload.progress && typeof payload.progress === "object"
        ? {
            transferredBytes: Number((payload.progress as Record<string, unknown>).transferredBytes ?? 0),
            totalBytes: Number((payload.progress as Record<string, unknown>).totalBytes ?? 0),
            percent: Number((payload.progress as Record<string, unknown>).percent ?? 0),
            speedBytesPerSecond: Number((payload.progress as Record<string, unknown>).speedBytesPerSecond ?? 0),
          }
        : null,
    updatedAt: typeof payload.updatedAt === "number" ? payload.updatedAt : null,
    gpuName: typeof payload.gpuName === "string" ? payload.gpuName : null,
    vramGb: typeof payload.vramGb === "number" ? payload.vramGb : null,
  };
};

const normalizeMiniBackendRuntimeArtifactOptions = (
  value: unknown,
): MiniBackendRuntimeArtifactOptionPayload[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const payload = entry as Record<string, unknown>;
    if (typeof payload.profile !== "string" || typeof payload.version !== "string") {
      return [];
    }

    return [{
      profile: payload.profile,
      version: payload.version,
      size: Number(payload.size ?? 0),
      installed: payload.installed === true,
      recommended: payload.recommended === true,
    }];
  });
};

// Taxonomia espelha packages/mini-backend/core/download_jobs.py.
const MODEL_DOWNLOAD_ERROR_CODES: ReadonlySet<string> = new Set([
  "network",
  "disk_full",
  "checksum_mismatch",
  "rate_limited",
  "cancelled",
  "unknown",
]);

const isModelDownloadErrorCode = (value: unknown): value is string =>
  typeof value === "string" && MODEL_DOWNLOAD_ERROR_CODES.has(value);

const normalizeModelManagerEvent = (value: unknown): ModelManagerEvent | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const type = typeof payload.type === "string" ? payload.type : "";
  const modelId = typeof payload.modelId === "string" ? payload.modelId : "";
  if (!type || !modelId) {
    return null;
  }

  switch (type) {
    case "queued":
      return {
        type,
        modelId,
        queueLength: Number(payload.queueLength ?? 0),
      };
    case "started":
      return {
        type,
        modelId,
        attempt: Number(payload.attempt ?? 1),
      };
    case "progress":
      return {
        type,
        modelId,
        bytesDownloaded: Number(payload.bytesDownloaded ?? 0),
        totalBytes: Number(payload.totalBytes ?? 0),
        speedBytesPerSecond: Number(payload.speedBytesPerSecond ?? 0),
        percent: Number(payload.percent ?? 0),
        attempt: Number(payload.attempt ?? 1),
      };
    case "verifying":
      return {
        type,
        modelId,
      };
    case "completed":
      return {
        type,
        modelId,
        version: typeof payload.version === "string" ? payload.version : "0.0.0",
        installedAt: typeof payload.installedAt === "string" ? payload.installedAt : new Date().toISOString(),
      };
    case "failed":
      return {
        type,
        modelId,
        message: typeof payload.message === "string" ? payload.message : "Download failed.",
        attempt: Number(payload.attempt ?? 1),
        willRetry: payload.willRetry === true,
        code: isModelDownloadErrorCode(payload.code) ? payload.code : undefined,
      };
    case "cancelled":
      return {
        type,
        modelId,
      };
    default:
      return null;
  }};

ipcRenderer.on("model-manager:event", (_event, rawPayload: unknown) => {
  const event = normalizeModelManagerEvent(rawPayload);
  if (!event) {
    return;
  }
  notifyModelManagerListeners(event);
});

ipcRenderer.on("mini-backend-runtime:event", (_event, rawPayload: unknown) => {
  const state = normalizeMiniBackendRuntimeState(rawPayload);
  if (!state) {
    return;
  }
  notifyMiniBackendRuntimeListeners(state);
});

ipcRenderer.on(DESKTOP_SHORTCUT_ACTION_CHANNEL, (_event, payload: unknown) => {
  const actionId =
    payload && typeof payload === "object" && typeof (payload as { actionId?: unknown }).actionId === "string"
      ? (payload as { actionId: string }).actionId
      : "";
  if (!actionId) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("koma-desktop-shortcut", {
      detail: { actionId },
    }),
  );
});

const installRendererSessionLogging = (): void => {
  const originalConsole = {
    log: window.console.log.bind(window.console),
    info: window.console.info.bind(window.console),
    warn: window.console.warn.bind(window.console),
    error: window.console.error.bind(window.console),
    debug: window.console.debug.bind(window.console),
  };

  window.console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    emitRendererSessionLog("log", args);
  };
  window.console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    emitRendererSessionLog("info", args);
  };
  window.console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    emitRendererSessionLog("warn", args);
  };
  window.console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    emitRendererSessionLog("error", args);
  };
  window.console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    emitRendererSessionLog("debug", args);
  };

  window.addEventListener("error", (event) => {
    const details = [
      "[window.error]",
      event.message,
      event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : "",
    ].filter(Boolean);
    if (event.error instanceof Error) {
      details.push(event.error.stack || event.error.message);
    }
    emitRendererSessionLog("error", details);
  });

  window.addEventListener("unhandledrejection", (event) => {
    emitRendererSessionLog("error", [
      "[unhandledrejection]",
      stringifyRendererLogArg(event.reason),
    ]);
  });
};

installRendererSessionLogging();

contextBridge.exposeInMainWorld("desktop", {
  getRuntimeConfig: () => readRuntimeConfig(),
  getMiniBackendRuntimeState: async (): Promise<unknown> =>
    normalizeMiniBackendRuntimeState(await invokeSecureDesktopApi("desktop:get-mini-backend-runtime-state")),
  listMiniBackendRuntimeArtifacts: async (): Promise<unknown> =>
    normalizeMiniBackendRuntimeArtifactOptions(await invokeSecureDesktopApi("desktop:list-mini-backend-runtime-artifacts")),
  installRecommendedMiniBackendRuntime: async (): Promise<unknown> =>
    invokeSecureDesktopApi("desktop:install-recommended-mini-backend-runtime"),
  installMiniBackendRuntimeProfile: async (profile: string): Promise<unknown> =>
    invokeSecureDesktopApi("desktop:install-mini-backend-runtime-profile", { profile }),
  resetLocalSettings: async (): Promise<unknown> =>
    invokeSecureDesktopApi("desktop:reset-local-settings"),
  restartApp: async (): Promise<unknown> =>
    invokeSecureDesktopApi("desktop:restart-app"),
  onMiniBackendRuntimeState: (listener: MiniBackendRuntimeListener): void => {
    miniBackendRuntimeListeners.add(listener);
  },
  offMiniBackendRuntimeState: (listener: MiniBackendRuntimeListener): void => {
    miniBackendRuntimeListeners.delete(listener);
  },
  locale: {
    getPreferences: async (): Promise<unknown> =>
      invokeSecureDesktopApi("desktop:locale:get-preferences"),
  },
  checkLocalBackend: async (): Promise<boolean> => {
    return ipcRenderer.invoke("desktop:check-local-backend");
  },
  restartLocalBackend: async (): Promise<boolean> => {
    return ipcRenderer.invoke("desktop:restart-local-backend");
  },
  openExternal: async (url: string): Promise<void> => {
    await invokeSecureDesktopApi("desktop:open-external", { url });
  },
  openCommunityLink: async (url: string): Promise<void> => {
    await invokeSecureDesktopApi("desktop:open-community-link", { url });
  },
  models: {
    listInstalled: async (): Promise<unknown> => invokeSecureDesktopApi("desktop-models:list-installed"),
    getDiskSpace: async (): Promise<unknown> => invokeSecureDesktopApi("desktop-models:get-disk-space"),
    checkUpdates: async (payloads: unknown[]): Promise<unknown> =>
      invokeSecureDesktopApi("desktop-models:check-updates", { payloads }),
    download: async (payload: {
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
    }): Promise<unknown> => invokeSecureDesktopApi("desktop-models:download", payload),
    importOnnx: async (payload: {
      id: string;
      name: string;
      version: string;
    }): Promise<unknown> => invokeSecureDesktopApi("desktop-models:import-onnx", payload),
    cancel: async (modelId: string): Promise<unknown> =>
      invokeSecureDesktopApi("desktop-models:cancel", { modelId }),
    cancelAll: async (): Promise<unknown> => invokeSecureDesktopApi("desktop-models:cancel-all"),
    uninstall: async (modelId: string): Promise<unknown> =>
      invokeSecureDesktopApi("desktop-models:uninstall", { modelId }),
    on: (listener: ModelManagerListener): void => {
      modelManagerListeners.add(listener);
    },
    off: (listener: ModelManagerListener): void => {
      modelManagerListeners.delete(listener);
    },
  },
  workspace: {
    loadAutosave: async (userId?: string | null): Promise<unknown> =>
      invokeSecureDesktopApi("desktop-workspace:load-autosave", { userId }),
    saveAutosave: async (payload: Record<string, unknown>): Promise<unknown> =>
      invokeSecureDesktopApi("desktop-workspace:save-autosave", payload),
    sendAutosave: (payload: Record<string, unknown>): void => {
      ipcRenderer.send("desktop-workspace:send-autosave", {
        ...payload,
        __ipcMeta: {
          nonce: createSecureNonce(),
          timestampMs: Date.now(),
        },
      });
    },
    clearAutosave: async (payload?: Record<string, unknown>): Promise<unknown> =>
      invokeSecureDesktopApi("desktop-workspace:clear-autosave", payload ?? {}),
    exportCurrent: async (payload: Record<string, unknown>): Promise<unknown> =>
      invokeSecureDesktopApi("desktop-workspace:export-current", payload),
    importFile: async (): Promise<unknown> =>
      invokeSecureDesktopApi("desktop-workspace:import-file"),
  },
  api: {
    auth: {
      config: async (): Promise<unknown> => invokeSecureDesktopApi("desktop-api:auth:config"),
      session: async (): Promise<unknown> => invokeSecureDesktopApi("desktop-api:auth:session"),
      login: async (payload: {
        email: string;
        password: string;
        captchaToken?: string;
        rememberMe?: boolean;
        travelToken?: string;
      }): Promise<unknown> => invokeSecureDesktopApi("desktop-api:auth:login", payload),
      register: async (payload: {
        email: string;
        password: string;
        name?: string;
        captchaToken?: string;
        travelToken?: string;
        legalAcceptance?: {
          termsAccepted: boolean;
          privacyAccepted: boolean;
          termsVersion: string;
          privacyVersion: string;
          cookiesVersion: string;
          contentVersion: string;
        };
      }): Promise<unknown> => invokeSecureDesktopApi("desktop-api:auth:register", payload),
      setTravelToken: async (token: string): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:auth:travel-token:set", { token }),
      createTravelToken: async (payload?: {
        ttlMinutes?: number;
        travelDays?: number;
        deliveryMode?: "copy" | "email";
      }): Promise<unknown> => invokeSecureDesktopApi("desktop-api:auth:travel-token:create", payload),
      verifyEmail: async (accessToken: string): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:auth:verify-email", { accessToken }),
      confirmEmail: async (token: string): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:auth:confirm-email", { token }),
      forgotPassword: async (email: string): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:auth:forgot-password", { email }),
      resetPassword: async (token: string, password: string): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:auth:reset-password", { token, password }),
      signOut: async (): Promise<unknown> => invokeSecureDesktopApi("desktop-api:auth:sign-out"),
      refreshSession: async (): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:auth:refresh-session"),
    },
    fonts: {
      list: async (): Promise<unknown> => invokeSecureDesktopApi("desktop-api:fonts:list"),
      import: async (payload: {
        fileName: string;
        contentBase64: string;
        family?: string;
      }): Promise<unknown> => invokeSecureDesktopApi("desktop-api:fonts:import", payload),
      install: async (payload: {
        fileName: string;
        contentBase64: string;
      }): Promise<unknown> => invokeSecureDesktopApi("desktop-api:fonts:install", payload),
      uninstall: async (payload: { fontFamily: string }): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:fonts:uninstall", payload),
    },
    identity: {
      hardwareId: async (): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:identity:hardware-id"),
      machineFingerprint: async (): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:identity:machine-fingerprint"),
    },
    integrations: {
      deepLink: {
        extract: async (payload: { argv: string[] }): Promise<unknown> =>
          invokeSecureDesktopApi("desktop-api:integrations:deep-link:extract", payload),
        route: async (payload: { url: string }): Promise<unknown> =>
          invokeSecureDesktopApi("desktop-api:integrations:deep-link:route", payload),
        format: async (payload: { url: string }): Promise<unknown> =>
          invokeSecureDesktopApi("desktop-api:integrations:deep-link:format", payload),
        navigate: async (payload: { url: string }): Promise<unknown> =>
          invokeSecureDesktopApi("desktop-api:integrations:deep-link:navigate", payload),
      },
    },
    security: {
      certPinningSnapshot: async (): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:security:cert-pinning:snapshot"),
    },
    llmProfiles: {
      list: async (userId: string): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:llm-profiles:list", { userId }),
      save: async (userId: string, profile: {
        id: string;
        stage: "translation" | "ocr";
        label: string;
        apiBase: string;
        apiKey: string;
        model: string;
        createdAt: string;
        updatedAt: string;
      }): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:llm-profiles:save", { userId, profile }),
      remove: async (userId: string, profileId: string): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:llm-profiles:remove", { userId, profileId }),
    },
    blogger: {
      loadConfig: async (): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:blogger:config:load"),
      saveConfig: async (config: Record<string, unknown>): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:blogger:config:save", config),
      testConnection: async (config?: Record<string, unknown>): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:blogger:test-connection", config),
      uploadImages: async (payload: Record<string, unknown>): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:blogger:upload-images", payload),
      publishPost: async (payload: Record<string, unknown>): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:blogger:publish-post", payload),
    },
    imgur: {
      loadConfig: async (): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:imgur:config:load"),
      saveConfig: async (config: Record<string, unknown>): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:imgur:config:save", config),
      uploadImages: async (payload: Record<string, unknown>): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:imgur:upload-images", payload),
    },
    discordWebhook: {
      send: async (payload: { url: string; body: Record<string, unknown> }): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:discord-webhook:send", payload),
    },
    bugReport: {
      prepare: async (): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:bug-report:prepare"),
      submit: async (payload: Record<string, unknown>): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:bug-report:submit", payload),
    },
  },
    images: {
      listFolder: async (payload: {
        folderPath: string;
      }): Promise<unknown> =>
        invokeSecureDesktopApi("desktop-api:images:list-folder", payload),
    },

    sessionLog: async (payload: {
      level: string;
      source: string;
      message: string;
    }): Promise<void> => ipcRenderer.send("desktop:session-log", payload),

  discordRPC: {
    setEnabled: async (enabled: boolean): Promise<boolean> =>
      ipcRenderer.invoke("discord-rpc:set-enabled", enabled),
    setActivity: async (data: unknown): Promise<void> =>
      ipcRenderer.invoke("discord-rpc:set-activity", data),
    setPreset: async (preset: string, overrides?: Record<string, unknown>): Promise<void> =>
      ipcRenderer.invoke("discord-rpc:set-preset", { preset, overrides: overrides ?? {} }),
    setCleaning: async (fileName: string, mode: string): Promise<void> =>
      ipcRenderer.invoke("discord-rpc:set-cleaning", { fileName, mode }),
    setTranslating: async (fileName: string, from: string, to: string): Promise<void> =>
      ipcRenderer.invoke("discord-rpc:set-translating", { fileName, from, to }),
    setTyping: async (fileName: string): Promise<void> =>
      ipcRenderer.invoke("discord-rpc:set-typing", { fileName }),
    setRedrawing: async (fileName: string): Promise<void> =>
      ipcRenderer.invoke("discord-rpc:set-redrawing", { fileName }),
    setDashboard: async (userName: string): Promise<void> =>
      ipcRenderer.invoke("discord-rpc:set-dashboard", { userName }),
    setBatchProcessing: async (
      fileCount: number,
      currentIndex: number,
      fileName?: string,
    ): Promise<void> => ipcRenderer.invoke("discord-rpc:set-batch", { fileCount, currentIndex, fileName }),
    setIdle: async (): Promise<void> => ipcRenderer.invoke("discord-rpc:set-idle"),
    clearActivity: async (): Promise<void> => ipcRenderer.invoke("discord-rpc:clear-activity"),
    isConnected: async (): Promise<boolean> => ipcRenderer.invoke("discord-rpc:is-connected"),
    isEnabled: async (): Promise<boolean> => ipcRenderer.invoke("discord-rpc:is-enabled"),
    getPresetAssets: async (): Promise<Record<string, string>> =>
      ipcRenderer.invoke("discord-rpc:get-preset-assets"),
  },
});

contextBridge.exposeInMainWorld("updater", {
  check: async (): Promise<UpdaterStatusPayload> => invokeUpdaterState("updater:check"),
  download: async (): Promise<UpdaterStatusPayload> => invokeUpdaterState("updater:download"),
  install: async (): Promise<UpdaterStatusPayload> => invokeUpdaterState("updater:install"),
  rollback: async (): Promise<UpdaterStatusPayload> => invokeUpdaterState("updater:rollback"),
  postpone: async (): Promise<UpdaterStatusPayload> => invokeUpdaterState("updater:postpone"),
  getStatus: async (): Promise<UpdaterStatusPayload> => invokeUpdaterState("updater:get-status"),
  setChannel: async (channel: "stable" | "beta"): Promise<UpdaterStatusPayload> =>
    invokeUpdaterState("updater:set-channel", channel),
  setAutoInstall: async (enabled: boolean): Promise<UpdaterStatusPayload> =>
    invokeUpdaterState("updater:set-auto-install", enabled),
  on: (eventName: UpdaterEventName, listener: UpdaterListener): void => {
    addUpdaterListener(eventName, listener);
  },
  off: (eventName: UpdaterEventName, listener: UpdaterListener): void => {
    removeUpdaterListener(eventName, listener);
  },
  offAll: (eventName?: UpdaterEventName): void => {
    removeAllUpdaterListeners(eventName);
  },
});
