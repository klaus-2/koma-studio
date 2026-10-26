import {
  app,
  BrowserWindow,
  ipcMain,
  net as electronNet,
  protocol,
  session as electronSession,
  shell,
  type Session,
} from "electron";
import path from "node:path";
import { spawn } from "node:child_process";

// Monorepo: the package was renamed to @koma/electron, but Electron's userData
// directory is derived from the package name — pin it to "koma-studio" to
// preserve the existing user profile (models, device-id, settings) under
// %APPDATA%.
app.setName("koma-studio");

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { discordRPC } from "./discord-rpc.ts";
import { registerUpdaterSyncService } from "./updater/sync-service";
import { resolveDesktopShortcutAction } from "./app-shortcuts.ts";
import {
  debugDesktopWarn,
  initializeAppSessionLog,
  installMainProcessConsoleSessionLogging,
  isDesktopDebugLogsEnabled,
  recordSessionLog,
  setDesktopDebugLogsEnabled,
} from "./modules/session-log.ts";
import { resolveAppFlags } from "./modules/app-flags.ts";
import {
  APP_PROTOCOL,
  INTERNAL_APP_ENTRY_URL,
  INTERNAL_APP_PROTOCOL,
} from "./modules/app-protocols.ts";
import {
  enforcePackagedRuntimeIntegrity,
  setupPermissionHardening,
} from "./modules/security.ts";
import {
  setupCertificatePinning,
} from "./modules/certificate-pinning.ts";
import {
  setupInternalAppProtocol,
} from "./modules/app-protocol-handler.ts";
import {
  configureExternalHosts,
  isAllowedExternalUrl,
  registerAllowedExternalHostFromUrl,
} from "./modules/external-hosts.ts";
import {
  clearDesktopAuthCookies,
  hasDesktopAuthCookie,
} from "./modules/desktop-auth-cookies.ts";
import {
  DESKTOP_UPDATE_CHANNEL,
} from "./modules/desktop-session-headers.ts";
import { createDesktopAuthSession } from "./modules/desktop-auth-session.ts";
import { createDesktopSessionApi } from "./modules/desktop-session-api.ts";
import { createWindowSecurity } from "./modules/window-security.ts";
import {
  createMiniBackendRuntimeStore,
} from "./modules/mini-backend-runtime-store.ts";
import { createMiniBackendRuntimeLogBuffer } from "./modules/mini-backend-runtime-log.ts";
import { createMiniBackendStateSync } from "./modules/mini-backend-state-sync.ts";
import { createMiniBackendSupervisor } from "./modules/mini-backend-supervisor.ts";
import { MiniBackendRestartError } from "./modules/mini-backend-restart-policy.ts";
import { collectMiniBackendGpuVendors } from "./modules/mini-backend-gpu.ts";
import {
  createMiniBackendProfileResolver,
} from "./modules/mini-backend-profile.ts";
import {
  ensureMiniBackendDevDependencies,
} from "./modules/mini-backend-dev-runtime.ts";
import { createMiniBackendCommandBuilder } from "./modules/mini-backend-command.ts";
import {
  getRandomLocalPort,
  waitForMiniBackend,
} from "./modules/mini-backend-process-utils.ts";
import { createMiniBackendManifestReader } from "./modules/mini-backend-runtime-manifest.ts";
import { createMiniBackendRuntimeInstaller } from "./modules/mini-backend-runtime-install.ts";
import { createManualRuntimeInstaller } from "./modules/mini-backend-manual-install.ts";
import { attachRendererDiagnostics } from "./modules/renderer-diagnostics.ts";
import { resolveDesktopEnvValue, setDesktopIsDev } from "./modules/runtime-env.ts";
import {
  parseDesktopRefreshSkewSec,
  parseDesktopTokenTtlSec,
} from "./modules/desktop-auth-constants.ts";
import { normalizeLoopbackUrl, parseConfiguredPort } from "./modules/app-urls.ts";
import { resolveMiniBackendStartupPolicy } from "./mini-backend-runtime-startup.ts";
import type { MiniBackendAccelerationProfile } from "./mini-backend-runtime.ts";

import {
  // Shared utilities
  registerSecureIpcHandler,
  fetchWithTimeoutAndRetry,
  isTravelTokenError,
  DESKTOP_FETCH_TIMEOUT_MS,
  DESKTOP_FETCH_RETRY_COUNT,
  assertTrustedIpcSender,
  isInternalAppUrl,
  getDevServerOrigin,
} from "./modules/shared.ts";
import { setupDesktopFontIpcHandlers } from "./modules/fonts.ts";
import { setupDesktopLlmProfilesIpcHandlers } from "./modules/llm-profiles.ts";
import {
  setupDiscordIpcHandlers,
  setupDesktopBloggerIpcHandlers,
  setupDesktopImgurIpcHandlers,
} from "./modules/integrations.ts";
import {
  resetDesktopLocalSettings,
  setupDesktopWorkspaceIpcHandlers,
} from "./modules/workspace.ts";
import { setupDesktopModelIpcHandlers } from "./modules/models.ts";
import { setupDesktopAuthIpcHandlers } from "./modules/desktop-auth-ipc.ts";
import { setupDesktopShellContractIpcHandlers } from "./modules/desktop-shell-contract-ipc.ts";
import { setupDesktopSessionLogIpcHandler } from "./modules/logging.ts";
import {
  extractDeepLinkFromArgv,
  navigateFromDeepLink,
} from "./modules/deep-link.ts";
import {
  setupDesktopBugReportIpcHandlers,
  setupDesktopDiscordWebhookIpcHandlers,
} from "./modules/bug-report.ts";

// Prevent external Chromium extensions/scripts from injecting renderer code.
app.commandLine.appendSwitch("disable-extensions");

let mainWindow: BrowserWindow | null = null;
let localApiSessionSecret = randomBytes(32).toString("hex");
let preparedMiniBackendPort: number | null = null;
// Latched before-quit / window-all-closed: the supervisor must never respawn
// the backend once shutdown has started.
let appExiting = false;


const MINI_BACKEND_RUNTIME_EVENT_CHANNEL = "mini-backend-runtime:event";

const MINI_BACKEND_RUNTIME_LOG_LIMIT = 600;
const DESKTOP_SHORTCUT_ACTION_CHANNEL = "desktop:shortcut-action";


const miniBackendRuntimeLog = createMiniBackendRuntimeLogBuffer(MINI_BACKEND_RUNTIME_LOG_LIMIT);

installMainProcessConsoleSessionLogging();

const appFlags = resolveAppFlags();
const isDev = appFlags.isDev;
const isProdDebugEnabled = appFlags.isProdDebugEnabled;
const areDevToolsEnabled = appFlags.areDevToolsEnabled;
setDesktopIsDev(isDev);
setDesktopDebugLogsEnabled(appFlags.debugLogsEnabled);

let pendingDeepLink: string | null = null;

const navigateMainWindowFromDeepLink = (urlValue: string): void => {
  navigateFromDeepLink(urlValue, { getMainWindow: () => mainWindow });
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: INTERNAL_APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

// Harden renderer debugging surface in production runtime.
if (!isDev) {
  app.commandLine.appendSwitch("remote-debugging-port", "0");
}

const rawAuthApiUrl = resolveDesktopEnvValue("VITE_AUTH_API_URL") ?? "http://127.0.0.1:3001";
const authApiUrl = (() => {
  if (isDev && rawAuthApiUrl.includes("auth.koma-studio.site")) {
    return "http://127.0.0.1:3001";
  }
  return rawAuthApiUrl;
})();
// Same tri-state as `isAuthDisabledFlag` in packages/types/src/auth-disabled.ts:
// an explicit value wins, and anything else falls back to the shell being
// unpackaged, so a repo checkout runs without the auth server while a packaged
// build keeps login.
const authDisabledFlag = (resolveDesktopEnvValue("VITE_AUTH_DISABLED") ?? "")
  .trim()
  .toLowerCase();
const isAuthDisabled = ["true", "1", "yes"].includes(authDisabledFlag)
  ? true
  : ["false", "0", "no"].includes(authDisabledFlag)
    ? false
    : !app.isPackaged;

let localApiUrl = normalizeLoopbackUrl(
  resolveDesktopEnvValue("VITE_LOCAL_API_URL") ?? "http://127.0.0.1:8001",
);
// Canonical runtime feed is GitHub Releases; env keys keep overriding it for
// channels/mirrors (VPS espelho) e testes locais.
const DEFAULT_RUNTIME_ARTIFACTS_URL =
  "https://github.com/klaus-2/koma-studio/releases/latest/download/";
const miniBackendArtifactsUrl =
  resolveDesktopEnvValue("MINI_BACKEND_ARTIFACTS_URL")
  ?? resolveDesktopEnvValue("UPDATE_SERVER_URL")
  ?? DEFAULT_RUNTIME_ARTIFACTS_URL;
const desktopBootstrapSecret = resolveDesktopEnvValue("DESKTOP_BOOTSTRAP_SECRET") ?? "";
configureExternalHosts({ authApiUrl, localApiUrl });


const desktopClientTokenTtlSec = parseDesktopTokenTtlSec(
  resolveDesktopEnvValue("DESKTOP_CLIENT_TOKEN_TTL_SECONDS") ?? undefined,
  600,
);
const desktopClientTokenRefreshSkewSec = parseDesktopRefreshSkewSec(
  resolveDesktopEnvValue("DESKTOP_CLIENT_TOKEN_REFRESH_SKEW_SECONDS") ?? undefined,
  90,
);
const parseBooleanEnv = (value: string | null, fallback: boolean): boolean => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
};
const enforceDesktopClient = parseBooleanEnv(
  resolveDesktopEnvValue("ENFORCE_DESKTOP_CLIENT"),
  app.isPackaged,
);

if (!desktopBootstrapSecret) {
  if (!enforceDesktopClient) {
    debugDesktopWarn(
      "[desktop-auth] DESKTOP_BOOTSTRAP_SECRET not found; legacy bootstrap secret fallback is disabled.",
    );
  }
}

const shouldDisableGpuInDev = ["1", "true", "yes"].includes(
  (process.env.ELECTRON_DISABLE_GPU ?? "").trim().toLowerCase(),
);

if (isDev && shouldDisableGpuInDev) {
  // Optional fallback for environments with GPU/driver instability in dev.
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
}



const runtimeStore = createMiniBackendRuntimeStore({
  eventChannel: MINI_BACKEND_RUNTIME_EVENT_CHANNEL,
  getMainWindow: () => mainWindow,
  initialState: {
    status: "idle",
    statusMessage: null,
    requestedProfile: "cpu",
    activeProfile: "cpu",
    source: "bundled-core",
    runtimeArtifactsUrl: miniBackendArtifactsUrl,
    runtimeManifestUrl: null,
    runtimeArchiveUrl: null,
    installDir: null,
    downloadCacheDir: path.join(app.getPath("temp"), "koma-runtime-downloads"),
    version: null,
    lastError: null,
    attempt: 0,
    maxAttempts: 0,
    exitCode: null,
    lastStderr: null,
    crashLogPath: null,
    progress: null,
    updatedAt: Date.now(),
    gpuName: null,
    vramGb: null,
  },
});


const { syncMiniBackendRuntimeStateFromApi } = createMiniBackendStateSync({
  getLocalApiUrl: () => localApiUrl,
  getLocalApiSessionSecret: () => localApiSessionSecret,
  runtimeStore,
});

const miniBackendSupervisor = createMiniBackendSupervisor({
  patchRuntimeState: (patch) => runtimeStore.patch(patch),
  pushRuntimeLog: (stream, text) => miniBackendRuntimeLog.push(stream, text),
  restart: () => startMiniBackend({ throwOnUnhealthy: true }),
  isAppExiting: () => appExiting,
});

const getDesktopRuntimeConfig = (): {
  authApiUrl: string;
  localApiUrl: string;
  runtimeArtifactsUrl?: string;
  appPackaged: boolean;
  authDisabled: boolean;
} => ({
  authApiUrl,
  localApiUrl,
  runtimeArtifactsUrl: miniBackendArtifactsUrl ?? undefined,
  appPackaged: app.isPackaged,
  authDisabled: isAuthDisabled,
});

const prepareMiniBackendLaunchContext = async (): Promise<void> => {
  const configuredPort = isDev ? null : parseConfiguredPort(resolveDesktopEnvValue("VITE_LOCAL_API_URL"));
  if (configuredPort) {
    preparedMiniBackendPort = configuredPort;
  } else if (!preparedMiniBackendPort) {
    preparedMiniBackendPort = await getRandomLocalPort();
  }

  localApiSessionSecret = randomBytes(32).toString("hex");
  localApiUrl = `http://127.0.0.1:${preparedMiniBackendPort}`;
  registerAllowedExternalHostFromUrl(localApiUrl);
};

const getDesktopHttpSession = (): Session => {
  return mainWindow?.webContents.session ?? electronSession.defaultSession;
};

const desktopAuth = createDesktopAuthSession({
  authApiUrl,
  bootstrapSecret: desktopBootstrapSecret,
  tokenTtlSec: desktopClientTokenTtlSec,
  refreshSkewSec: desktopClientTokenRefreshSkewSec,
  enforceDesktopClient,
  getDesktopHttpSession,
  resolveDesktopEnvValue,
});



const { resolveMiniBackendAccelerationProfile } = createMiniBackendProfileResolver({
  resolveDesktopEnvValue,
  runtimeStore,
  collectGpuVendors: collectMiniBackendGpuVendors,
});


const {
  desktopSessionApiFetch,
  fetchDesktopCookieSessionEnvelope,
} = createDesktopSessionApi({
  desktopAuth,
  authApiUrl,
  getDesktopHttpSession,
});

const { getMiniBackendCommand } = createMiniBackendCommandBuilder({
  isDev,
  runtimeStore,
  miniBackendArtifactsUrl,
  resolveAccelerationProfile: resolveMiniBackendAccelerationProfile,
});

// Runtime artifact traffic goes through Chromium's stack (electronNet) instead
// of Node's undici fetch so the session's certificate pin verify proc applies.
// Request objects pass through untouched (method/headers/body intact); only a
// URL needs converting, because net.fetch's input union has no URL.
const runtimeArtifactsFetch: typeof fetch = (input, init) =>
  electronNet.fetch(input instanceof URL ? input.toString() : input, init);

const {
  listMiniBackendRuntimeArtifacts,
  readMiniBackendRuntimeManifest,
} = createMiniBackendManifestReader({
  runtimeStore,
  miniBackendArtifactsUrl,
  fetchImpl: runtimeArtifactsFetch,
  resolveAccelerationProfile: resolveMiniBackendAccelerationProfile,
});


const {
  ensureMiniBackendDownloadedRuntime,
} = createMiniBackendRuntimeInstaller({
  isDev,
  runtimeStore,
  miniBackendArtifactsUrl,
  fetchImpl: runtimeArtifactsFetch,
  readManifest: readMiniBackendRuntimeManifest,
});


interface StartMiniBackendOptions {
  /** Supervisor restarts: surface a health timeout so recovery can count it. */
  throwOnUnhealthy?: boolean;
}

const startMiniBackend = async (options: StartMiniBackendOptions = {}): Promise<void> => {
  await prepareMiniBackendLaunchContext();
  const commandSpec = await getMiniBackendCommand();
  const { command, args, cwd } = commandSpec;
  ensureMiniBackendDevDependencies(commandSpec, isDev);
  const miniBackendPort = preparedMiniBackendPort ?? (await getRandomLocalPort());
  const desktopModelsRootDir = path.join(app.getPath("userData"), "models");
  const appResourcesDir = path.join(process.resourcesPath, "resources");
  const referenceImagesDir = path.join(appResourcesDir, "reference_images");
  fs.mkdirSync(desktopModelsRootDir, { recursive: true });

  runtimeStore.patch({
    requestedProfile: commandSpec.env?.MINI_BACKEND_ACCELERATION_PROFILE
      ? (commandSpec.env.MINI_BACKEND_ACCELERATION_PROFILE as MiniBackendAccelerationProfile)
      : runtimeStore.getState().requestedProfile,
    activeProfile: commandSpec.env?.MINI_BACKEND_ACCELERATION_PROFILE
      ? (commandSpec.env.MINI_BACKEND_ACCELERATION_PROFILE as MiniBackendAccelerationProfile)
      : runtimeStore.getState().activeProfile,
    source: commandSpec.runtimeSource ?? runtimeStore.getState().source,
    installDir: commandSpec.installDir ?? runtimeStore.getState().installDir,
    version: commandSpec.version ?? runtimeStore.getState().version,
    downloadCacheDir: path.join(app.getPath("temp"), "koma-runtime-downloads"),
    status: "checking",
    statusMessage: commandSpec.runtimeSource === "downloaded-runtime"
      ? "Starting downloaded runtime."
      : "Starting local runtime.",
    lastError: null,
    progress: null,
  });

  const child = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...commandSpec.env,
      NODE_ENV: isDev ? "development" : "production",
      PORT: String(miniBackendPort),
      KOMA_MODELS_ROOT: desktopModelsRootDir,
      KOMA_LOCAL_API_SESSION_SECRET: localApiSessionSecret,
      KOMA_APP_RESOURCES_DIR: appResourcesDir,
      KOMA_REFERENCE_IMAGES_DIR: referenceImagesDir,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
  });
  miniBackendSupervisor.register(child);

  const startupPolicy = resolveMiniBackendStartupPolicy({
    isDev,
    source: commandSpec.runtimeSource ?? "bundled-core",
  });
  const healthy = await waitForMiniBackend(localApiUrl, startupPolicy.initial);
  if (!healthy) {
    runtimeStore.patch({
      status: "error",
      statusMessage: "Mini backend did not become healthy in time.",
      lastError: "mini_backend_health_timeout",
    });
    console.warn("Mini backend did not report healthy state in time");
    if (options.throwOnUnhealthy) {
      // The unhealthy child is still registered; stop it before the
      // supervisor schedules the next attempt so only one child can run.
      await miniBackendSupervisor.stop();
      throw new MiniBackendRestartError(
        "health-timeout",
        "Mini backend did not become healthy in time.",
      );
    }
    return;
  }
  miniBackendSupervisor.markHealthy();
  await syncMiniBackendRuntimeStateFromApi();
};

const setupDesktopExternalIpcHandlers = (): void => {
  registerSecureIpcHandler<{
    appLocale: string;
    systemLocales: string[];
  }>("desktop:locale:get-preferences", async () => {
    const appLocale = typeof app.getLocale === "function" ? app.getLocale() : "pt-BR";
    const systemLocales =
      typeof app.getPreferredSystemLanguages === "function"
        ? app.getPreferredSystemLanguages()
        : [appLocale];

    return {
      appLocale,
      systemLocales,
    };
  });

  registerSecureIpcHandler<void>("desktop:open-external", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const targetUrl = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!targetUrl) {
      throw new Error("URL externa ausente.");
    }
    if (!isAllowedExternalUrl(targetUrl)) {
      throw new Error("External URL not allowed.");
    }

    await shell.openExternal(targetUrl);
  });

  registerSecureIpcHandler<void>("desktop:open-community-link", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const targetUrl = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!targetUrl) {
      throw new Error("URL comunitaria ausente.");
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      throw new Error("URL comunitaria invalida.");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("Apenas links HTTPS sao permitidos.");
    }

    await shell.openExternal(parsed.toString());
  });
};
registerSecureIpcHandler<{
  cleared: true;
  userDataPath: string;
  clearedPaths: string[];
}>("desktop:reset-local-settings", async () => resetDesktopLocalSettings());

registerSecureIpcHandler<{ restarting: true }>("desktop:restart-app", async () => {
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 0);

  return { restarting: true };
});


const {
  setupDesktopClientHeaderInjection,
  setupNavigationHardening,
} = createWindowSecurity({
  authApiUrl,
  getLocalApiUrl: () => localApiUrl,
  getLocalApiSessionSecret: () => localApiSessionSecret,
  desktopAuth,
  desktopClientTokenRefreshSkewSec,
  isAllowedExternalUrl,
  isInternalAppUrl,
  getDevServerOrigin,
});

const createWindow = async (): Promise<void> => {
  await prepareMiniBackendLaunchContext();
  if (!isAuthDisabled && (await hasDesktopAuthCookie(authApiUrl, getDesktopHttpSession()))) {
    try {
      await desktopAuth.registerDeviceKey("startup");
      await desktopAuth.ensureToken("startup");
    } catch (error) {
      if (isTravelTokenError(error)) {
        await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
        desktopAuth.clearSessionState(true);
      }
      debugDesktopWarn(
        `[desktop-auth] initial bootstrap failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: "KŌMA Studio",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: areDevToolsEnabled,
    },
  });

  attachRendererDiagnostics(mainWindow);

  // Recover from renderer crashes (often a follow-on from a GPU crash).
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    console.error(`[Renderer] process gone (${details.reason}, exit ${details.exitCode}) – reloading`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const target = process.env.VITE_DEV_SERVER_URL ?? INTERNAL_APP_ENTRY_URL;
        void mainWindow.loadURL(target);
      }
    }, 500);
  });

  setupDesktopClientHeaderInjection(mainWindow);
  setupNavigationHardening(mainWindow);
  registerUpdaterSyncService();

  if (process.env.VITE_DEV_SERVER_URL) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;

    // Wait for the Vite dev server before loadURL to avoid ERR_FAILED races
    // when Electron starts before Vite is serving.
    const maxRetries = 30;
    const retryDelayMs = 333;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        await fetch(devServerUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(2_500),
        });
        break;
      } catch {
        // Server not ready yet — will retry.
      }

      if (attempt < maxRetries) {
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    await mainWindow.loadURL(devServerUrl);
    if (areDevToolsEnabled) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    await mainWindow.loadURL(INTERNAL_APP_ENTRY_URL);
    mainWindow.setMenu(null);
    if (isProdDebugEnabled) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  }

  void startMiniBackend().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    runtimeStore.patch({
      status: "error",
      statusMessage: "Mini backend failed to start.",
      lastError: message,
      progress: null,
    });
    console.error(`[mini-backend] startup failed: ${message}`);
  });

  if (!isDev && !isProdDebugEnabled) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      const shortcutAction = resolveDesktopShortcutAction(input);
      if (shortcutAction) {
        event.preventDefault();
        mainWindow?.webContents.send(DESKTOP_SHORTCUT_ACTION_CHANNEL, { actionId: shortcutAction });
        return;
      }

      const isF12 = input.key.toLowerCase() === "f12";
      const isCtrlShiftInspector =
        input.control &&
        input.shift &&
        (input.key.toLowerCase() === "i" || input.key.toLowerCase() === "j" || input.key.toLowerCase() === "c");
      if (isF12 || isCtrlShiftInspector) {
        event.preventDefault();
      }
    });
  }

  if (pendingDeepLink) {
    navigateMainWindowFromDeepLink(pendingDeepLink);
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (!pendingDeepLink) {
      return;
    }
    navigateMainWindowFromDeepLink(pendingDeepLink);
    pendingDeepLink = null;
  });

  setTimeout(() => {
    void discordRPC.connectWithRetry();
  }, 2_000);
};

const stopMiniBackend = (): Promise<void> => miniBackendSupervisor.stop();

const gotTheLock = app.requestSingleInstanceLock();

// Module-based IPC handler registration

const {
  installMiniBackendRuntimeProfile,
  installRecommendedMiniBackendRuntime,
} = createManualRuntimeInstaller({
  isDev,
  runtimeStore,
  resolveAccelerationProfile: () => resolveMiniBackendAccelerationProfile(),
  ensureDownloadedRuntime: ensureMiniBackendDownloadedRuntime,
  restartBackend: async () => {
    await stopMiniBackend();
    await startMiniBackend();
  },
});

setupDiscordIpcHandlers();
setupDesktopExternalIpcHandlers();
setupDesktopWorkspaceIpcHandlers({ getMainWindow: () => mainWindow });
setupDesktopModelIpcHandlers({
  getMainWindow: () => mainWindow,
  getLocalApiUrl: () => localApiUrl,
  getLocalApiSessionSecret: () => localApiSessionSecret,
});
setupDesktopFontIpcHandlers();
setupDesktopLlmProfilesIpcHandlers();
setupDesktopBloggerIpcHandlers();
setupDesktopImgurIpcHandlers();
setupDesktopDiscordWebhookIpcHandlers();
setupDesktopBugReportIpcHandlers({
  getMainWindow: () => mainWindow,
  resolveDesktopEnvValue,
  getDesktopUpdateChannel: () => DESKTOP_UPDATE_CHANNEL,
  miniBackendRuntimeLogBuffer: miniBackendRuntimeLog.getEntries(),
  miniBackendProcessRef: () => miniBackendSupervisor.getProcess(),
  authApiUrl,
  localApiUrl,
});
setupDesktopAuthIpcHandlers({
  desktopAuth,
  authApiUrl,
  getDesktopHttpSession,
  desktopSessionApiFetch,
  fetchDesktopCookieSessionEnvelope,
});
setupDesktopShellContractIpcHandlers({
  authApiUrl,
  navigateMainWindowFromDeepLink,
});
setupDesktopSessionLogIpcHandler({ recordSessionLog });
ipcMain.on("desktop:get-runtime-config", (event) => {
  assertTrustedIpcSender(event, "desktop:get-runtime-config");
  event.returnValue = getDesktopRuntimeConfig();
});
ipcMain.handle("desktop:get-mini-backend-runtime-state", async (event) => {
  assertTrustedIpcSender(event, "desktop:get-mini-backend-runtime-state");
  return runtimeStore.getSnapshot();
});
ipcMain.handle("desktop:list-mini-backend-runtime-artifacts", async (event) => {
  assertTrustedIpcSender(event, "desktop:list-mini-backend-runtime-artifacts");
  return listMiniBackendRuntimeArtifacts();
});
ipcMain.handle("desktop:install-recommended-mini-backend-runtime", async (event) => {
  assertTrustedIpcSender(event, "desktop:install-recommended-mini-backend-runtime");
  return installRecommendedMiniBackendRuntime();
});
ipcMain.handle("desktop:install-mini-backend-runtime-profile", async (event, payload) => {
  assertTrustedIpcSender(event, "desktop:install-mini-backend-runtime-profile");
  const profile = payload && typeof payload === "object" && typeof (payload as { profile?: unknown }).profile === "string"
    ? (payload as { profile: string }).profile
    : "";
  return installMiniBackendRuntimeProfile(profile);
});
ipcMain.handle("desktop:check-local-backend", async (event) => {
  assertTrustedIpcSender(event, "desktop:check-local-backend");
  try {
    const response = await fetchWithTimeoutAndRetry(
      (signal) =>
        fetch(`${localApiUrl}/health`, {
          method: "GET",
          signal,
        }),
      { method: "GET" },
      {
        timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
        retryCount: DESKTOP_FETCH_RETRY_COUNT,
      },
    );
    return response.ok;
  } catch {
    return false;
  }
});
ipcMain.handle("desktop:restart-local-backend", async (event) => {
  assertTrustedIpcSender(event, "desktop:restart-local-backend");
  try {
    await stopMiniBackend();
    await startMiniBackend();
    return true;
  } catch (error) {
    console.error(
      `[mini-backend] restart failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
});

process.once("exit", () => {
  miniBackendSupervisor.runExitCleanup();
});

if (process.platform === "win32") {
  // Dev/portable registration so browser links can reopen/focus the app.
  if (isDev) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1] ?? "")]);
  } else {
    app.setAsDefaultProtocolClient(APP_PROTOCOL);
  }
}

const initialDeepLink = extractDeepLinkFromArgv(process.argv);
if (initialDeepLink) {
  pendingDeepLink = initialDeepLink;
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = extractDeepLinkFromArgv(argv);
    if (deepLink) {
      pendingDeepLink = deepLink;
    }

    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();

    if (pendingDeepLink) {
      navigateMainWindowFromDeepLink(pendingDeepLink);
    }
  });

  app.on("open-url", (event, urlValue) => {
    event.preventDefault();
    pendingDeepLink = urlValue;
    if (mainWindow) {
      navigateMainWindowFromDeepLink(urlValue);
      pendingDeepLink = null;
    }
  });

  app.whenReady().then(async () => {
    // Strip Electron and App specific strings from user agent to bypass Turnstile bot detection
    app.userAgentFallback = app.userAgentFallback.replace(/Electron\/\S+\s?/, "").replace(/koma-studio\/\S+\s?/, "").replace(/ScanlatorPro\/\S+\s?/, "").trim();

    if (isDesktopDebugLogsEnabled()) {
      initializeAppSessionLog();
    }
    enforcePackagedRuntimeIntegrity(isDev);
    setupInternalAppProtocol(isDev);
    setupPermissionHardening(electronSession.defaultSession);
    setupCertificatePinning(isDev, electronSession.defaultSession, authApiUrl);
    await createWindow();
  });
}

// When the GPU process crashes (Skia OOM, driver fault, etc.) Chromium automatically
// restarts it.  Give it 1.5 s to recover then reload the window so the user sees
// a working UI instead of a frozen white/black frame.
let gpuCrashReloadScheduled = false;
// @ts-ignore – gpu-process-crashed is valid at runtime but absent from Electron's strict TS overloads
app.on("gpu-process-crashed", (_event, killed) => {
  console.error(`[GPU] process ${killed ? "killed" : "crashed"} – scheduling window reload`);
  if (gpuCrashReloadScheduled) return;
  gpuCrashReloadScheduled = true;
  setTimeout(() => {
    gpuCrashReloadScheduled = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  }, 1500);
});

app.on("window-all-closed", () => {
  appExiting = true;
  miniBackendSupervisor.markAppExiting();
  void discordRPC.disconnect();
  desktopAuth.clearTokenRefreshTimeout();
  void stopMiniBackend().finally(() => {
    app.quit();
  });
});

app.on("before-quit", (event) => {
  appExiting = true;
  miniBackendSupervisor.markAppExiting();
  void discordRPC.disconnect();
  desktopAuth.clearTokenRefreshTimeout();
  const runningBackendProcess = miniBackendSupervisor.getProcess();
  if (runningBackendProcess && !runningBackendProcess.killed) {
    event.preventDefault();
    void stopMiniBackend().finally(() => {
      app.quit();
    });
  }
});
