import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  session as electronSession,
  shell,
  type Session,
} from "electron";
import path from "node:path";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";

// Monorepo: the package was renamed to @koma/electron, but Electron's userData
// directory is derived from the package name — pin it to "koma-studio" to
// preserve the existing user profile (models, device-id, settings) under
// %APPDATA%.
app.setName("koma-studio");

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import nodeNet from "node:net";
import {
  resolveDesktopSessionRecoveryAction,
  type DesktopSessionRecoveryAction,
} from "../../../packages/types/src/desktopSessionRecovery.ts";
import { discordRPC } from "./discord-rpc.ts";
import { registerUpdaterSyncService } from "./updater/sync-service";
import { resolveDesktopShortcutAction } from "./app-shortcuts.ts";
import {
  debugDesktopError,
  debugDesktopInfo,
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
  INTERNAL_APP_HOST,
  INTERNAL_APP_PROTOCOL,
} from "./modules/app-protocols.ts";
import {
  enforcePackagedRuntimeIntegrity,
  setupPermissionHardening,
} from "./modules/security.ts";
import {
  getCertificatePinsByHost,
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
  buildDesktopSessionHeaders,
  getDesktopUpdateChannel,
} from "./modules/desktop-session-headers.ts";
import { resolveDesktopDeviceId } from "./modules/desktop-device-id.ts";
import { createDesktopAuthSession } from "./modules/desktop-auth-session.ts";
import {
  createMiniBackendRuntimeStore,
} from "./modules/mini-backend-runtime-store.ts";
import { createMiniBackendRuntimeLogBuffer } from "./modules/mini-backend-runtime-log.ts";
import {
  ensureMiniBackendRuntimeDiskSpace,
  isRetryableRuntimeDownloadError,
} from "./modules/mini-backend-runtime-disk.ts";
import {
  canRunCommand,
  readPackagedMiniBackendManifest,
  resolvePackagedMiniBackendBinary,
  runCommand,
  type CommandSpec,
  type MiniBackendCommandSpec,
} from "./modules/mini-backend-packaged.ts";
import { collectMiniBackendGpuVendors } from "./modules/mini-backend-gpu.ts";
import {
  createMiniBackendProfileResolver,
  normalizeAccelerationProfileOverride,
} from "./modules/mini-backend-profile.ts";
import { attachRendererDiagnostics } from "./modules/renderer-diagnostics.ts";
import { resolveDesktopEnvValue, setDesktopIsDev } from "./modules/runtime-env.ts";
import {
  DESKTOP_APP_VERSION_HEADER,
  DESKTOP_CLIENT_TOKEN_HEADER,
  DESKTOP_DEVICE_ID_HEADER,
  DESKTOP_SESSION_ID_HEADER,
  DESKTOP_TRAVEL_TOKEN_PATH,
  DESKTOP_UPDATE_CHANNEL_HEADER,
  LOCAL_API_SESSION_HEADER,
  parseDesktopRefreshSkewSec,
  parseDesktopTokenTtlSec,
} from "./modules/desktop-auth-constants.ts";
import { normalizeLoopbackUrl, parseConfiguredPort } from "./modules/app-urls.ts";
import { resolveRendererCorsOrigin } from "./modules/app-protocols.ts";
import {
  listMiniBackendRuntimeArtifactOptions,
  sanitizeMiniBackendProfile,
  type MiniBackendRuntimeArtifactOption,
  type MiniBackendRuntimeArtifactManifest,
  type MiniBackendRuntimeArtifactRecord,
} from "./mini-backend-artifacts.ts";
import { buildDevPythonRuntimePathCandidates } from "./dev-python-runtime.ts";
import {
  downloadUrlToFileWithResume,
  resolveRuntimeTransferTimeoutMs,
  runWithRetry,
  RUNTIME_DOWNLOAD_RETRY_COUNT,
} from "./mini-backend-runtime-download.ts";
import {
  readMiniBackendRuntimeSelection,
  resolveSelectedRuntimeBinaryPath,
  writeMiniBackendRuntimeSelection,
} from "./mini-backend-runtime-selection.ts";
import { resolveMiniBackendStartupPolicy } from "./mini-backend-runtime-startup.ts";
import {
  buildManualInstallBlockedState,
  formatRuntimeFallbackReason,
  resolveEffectiveAccelerationProfile,
  resolveManifestEntry,
  type MiniBackendAccelerationProfile,
} from "./mini-backend-runtime.ts";

import {
  // Shared utilities
  sleep,
  normalizeHttpMethod,
  normalizeAccessToken,
  sanitizeSessionLogText,
  registerSecureIpcHandler,
  fetchWithTimeoutAndRetry,
  parseResponsePayload,
  resolveDesktopErrorCode,
  isDesktopStructuredError,
  extractDesktopApiErrorMessage,
  summarizeDesktopApiPayload,
  toDesktopAuthErrorEnvelope,
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
import { setupDesktopSessionLogIpcHandler } from "./modules/logging.ts";
import {
  extractDeepLinkFromArgv,
  deepLinkToHashRoute,
  formatDeepLinkForLog,
  navigateFromDeepLink,
} from "./modules/deep-link.ts";
import {
  setupDesktopBugReportIpcHandlers,
  setupDesktopDiscordWebhookIpcHandlers,
} from "./modules/bug-report.ts";

// Prevent external Chromium extensions/scripts from injecting renderer code.
app.commandLine.appendSwitch("disable-extensions");

let mainWindow: BrowserWindow | null = null;
let miniBackendProcess: ChildProcess | null = null;
let miniBackendShutdownPromise: Promise<void> | null = null;
let miniBackendExitPromise: Promise<void> | null = null;
// Stable reference for the synchronous process.once("exit") handler.
// stopMiniBackend() nulls miniBackendProcess before kill completes, so the
// exit handler needs its own copy to guarantee the child is killed.
let miniBackendProcessForExitCleanup: ChildProcess | null = null;
let localApiSessionSecret = randomBytes(32).toString("hex");
let preparedMiniBackendPort: number | null = null;
let miniBackendRuntimeInstallPromise: Promise<{
  ok: boolean;
  profile: string;
  reason: string | null;
}> | null = null;

interface MiniBackendDeviceInfoPayload {
  profile?: string;
  active_profile?: string;
  provider?: string;
  fallback_reason?: string | null;
  name?: string;
  vram_gb?: number | null;
}

const MINI_BACKEND_RUNTIME_EVENT_CHANNEL = "mini-backend-runtime:event";
const RUNTIME_ARCHIVE_EXTRACT_TIMEOUT_MS = 60 * 60_000;

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
const isAuthDisabled = ["true", "1", "yes"].includes(
  (resolveDesktopEnvValue("VITE_AUTH_DISABLED") ?? "").trim().toLowerCase(),
);

let localApiUrl = normalizeLoopbackUrl(
  resolveDesktopEnvValue("VITE_LOCAL_API_URL") ?? "http://127.0.0.1:8001",
);
const miniBackendArtifactsUrl =
  resolveDesktopEnvValue("MINI_BACKEND_ARTIFACTS_URL")
  ?? resolveDesktopEnvValue("UPDATE_SERVER_URL");
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
    progress: null,
    updatedAt: Date.now(),
    gpuName: null,
    vramGb: null,
  },
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

const installRecommendedMiniBackendRuntime = async (): Promise<{
  ok: boolean;
  profile: string;
  reason: string | null;
}> => {
  if (miniBackendRuntimeInstallPromise) {
    return miniBackendRuntimeInstallPromise;
  }

  miniBackendRuntimeInstallPromise = (async () => {
    const profile = await resolveMiniBackendAccelerationProfile();
    if (isDev) {
      runtimeStore.patch(buildManualInstallBlockedState({
        reason: "dev-only-unavailable",
        requestedProfile: profile,
        activeProfile: runtimeStore.getState().activeProfile,
        source: runtimeStore.getState().source,
      }));
      return { ok: false, profile, reason: "runtime_manual_install_dev_only_unavailable" };
    }
    if (profile === "cpu") {
      runtimeStore.patch(buildManualInstallBlockedState({
        reason: "cpu-not-required",
        requestedProfile: profile,
        activeProfile: runtimeStore.getState().activeProfile,
        source: runtimeStore.getState().source,
      }));
      return { ok: false, profile, reason: "runtime_manual_install_cpu_not_required" };
    }

    const installedRuntime = await ensureMiniBackendDownloadedRuntime(profile);
    if (!installedRuntime) {
      return {
        ok: false,
        profile,
        reason: runtimeStore.getState().lastError ?? "runtime_manual_install_failed",
      };
    }

    writeMiniBackendRuntimeSelection(app.getPath("userData"), {
      profile,
      version: installedRuntime.version,
      entry: path.basename(installedRuntime.binaryPath),
    });
    await stopMiniBackend();
    await startMiniBackend();
    return { ok: true, profile, reason: null };
  })();

  try {
    return await miniBackendRuntimeInstallPromise;
  } finally {
    miniBackendRuntimeInstallPromise = null;
  }
};

const installMiniBackendRuntimeProfile = async (
  profileInput: string,
): Promise<{
  ok: boolean;
  profile: string;
  reason: string | null;
}> => {
  if (miniBackendRuntimeInstallPromise) {
    return miniBackendRuntimeInstallPromise;
  }

  miniBackendRuntimeInstallPromise = (async () => {
    const normalizedProfile = normalizeAccelerationProfileOverride(profileInput);
    if (normalizedProfile === "auto") {
      return { ok: false, profile: profileInput, reason: "runtime_manual_install_invalid_profile" };
    }

    if (isDev) {
      runtimeStore.patch(buildManualInstallBlockedState({
        reason: "dev-only-unavailable",
        requestedProfile: normalizedProfile,
        activeProfile: runtimeStore.getState().activeProfile,
        source: runtimeStore.getState().source,
      }));
      return { ok: false, profile: normalizedProfile, reason: "runtime_manual_install_dev_only_unavailable" };
    }

    const installedRuntime = await ensureMiniBackendDownloadedRuntime(normalizedProfile, {
      allowCpuDownload: true,
    });
    if (!installedRuntime) {
      return {
        ok: false,
        profile: normalizedProfile,
        reason: runtimeStore.getState().lastError ?? "runtime_manual_install_failed",
      };
    }

    writeMiniBackendRuntimeSelection(app.getPath("userData"), {
      profile: normalizedProfile,
      version: installedRuntime.version,
      entry: path.basename(installedRuntime.binaryPath),
    });
    await stopMiniBackend();
    await startMiniBackend();
    return { ok: true, profile: normalizedProfile, reason: null };
  })();

  try {
    return await miniBackendRuntimeInstallPromise;
  } finally {
    miniBackendRuntimeInstallPromise = null;
  }
};

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

const recoverDesktopSession = async (
  action: DesktopSessionRecoveryAction,
): Promise<boolean> => {
  if (!action) {
    return false;
  }

  const attemptRecovery = async (clearDeviceKey: boolean): Promise<boolean> => {
    desktopAuth.clearSessionState(clearDeviceKey);
    return desktopAuth.refreshToken("on-demand");
  };

  const initialRecovery = await attemptRecovery(action === "refresh-device");
  if (initialRecovery) {
    return true;
  }

  if (action === "refresh-session") {
    return attemptRecovery(true);
  }

  return false;
};

interface DesktopApiEnvelope<T = unknown> {
  ok: boolean;
  status: number;
  payload: T | null;
}

const desktopSessionApiFetch = async (
  endpointPath: string,
  init: RequestInit = {},
  options: { requireDesktopSession?: boolean } = {},
): Promise<DesktopApiEnvelope> => {
  const requireDesktopSession = options.requireDesktopSession === true;
  const method = normalizeHttpMethod(init.method);
  const targetUrl = new URL(endpointPath, authApiUrl).toString();
  const sessionClient = getDesktopHttpSession();

  try {
    if (requireDesktopSession) {
      await desktopAuth.ensureToken("on-demand");
    }

    debugDesktopInfo(
      `[desktop-auth] request start method=${method} endpoint=${endpointPath} desktopSession=${requireDesktopSession ? "required" : "optional"} token=${desktopAuth.getState().token ? "yes" : "no"}`,
    );
    const sendRequest = async (): Promise<{ response: globalThis.Response; payload: unknown }> => {
      const requestInit: RequestInit = {
        ...init,
        headers: buildDesktopSessionHeaders(init.headers, undefined, desktopAuth.getState(), app.getVersion()),
      };

      const response = await fetchWithTimeoutAndRetry(
        (signal) =>
          sessionClient.fetch(targetUrl, {
            ...requestInit,
            signal,
          }),
        requestInit,
        {
          timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
          retryCount: DESKTOP_FETCH_RETRY_COUNT,
        },
      );
      const payload = await parseResponsePayload(response);
      return { response, payload };
    };

    let result = await sendRequest();
    if (!result.response.ok) {
      const recoveryAction = resolveDesktopSessionRecoveryAction(
        result.response.status,
        result.payload,
      );
      debugDesktopWarn(
        `[desktop-auth] request failed method=${method} endpoint=${endpointPath} status=${result.response.status} recovery=${recoveryAction ?? "none"} ${summarizeDesktopApiPayload(
          result.payload,
        )}`,
      );
      if (await recoverDesktopSession(recoveryAction)) {
        debugDesktopInfo(
          `[desktop-auth] request retry after recovery method=${method} endpoint=${endpointPath} recovery=${recoveryAction}`,
        );
        result = await sendRequest();
      }
    }

    debugDesktopInfo(
      `[desktop-auth] request done method=${method} endpoint=${endpointPath} status=${result.response.status} ok=${result.response.ok}`,
    );

    return {
      ok: result.response.ok,
      status: result.response.status,
      payload: result.payload,
    };
  } catch (error) {
    if (isDesktopStructuredError(error)) {
      debugDesktopWarn(
        `[desktop-auth] request structured-failed method=${method} endpoint=${endpointPath} status=${error.status} ${summarizeDesktopApiPayload(
          error.payload,
        )}`,
      );
      return toDesktopAuthErrorEnvelope(
        error,
        "Desktop session failure.",
        error.code ?? "DESKTOP_BOOTSTRAP_FAILED",
      );
    }

    debugDesktopError(
      `[desktop-auth] request network-failed method=${method} endpoint=${endpointPath} url=${targetUrl} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      ok: false,
      status: 503,
      payload: {
        error: error instanceof Error ? error.message : "Failed to connect to auth-server.",
        code: "DESKTOP_API_UNAVAILABLE",
      },
    };
  }
};

const fetchDesktopCookieSessionEnvelope = async (): Promise<DesktopApiEnvelope> =>
  desktopSessionApiFetch(
    "/api/auth/session",
    { method: "GET" },
    { requireDesktopSession: false },
  );

const setupDesktopAuthIpcHandlers = (): void => {
  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:config", async () => {
    return desktopSessionApiFetch(
      "/api/auth/config",
      { method: "GET" },
      { requireDesktopSession: false },
    );
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:session", async () => {
    if (!(await hasDesktopAuthCookie(authApiUrl, getDesktopHttpSession()))) {
      debugDesktopInfo("[desktop-auth] session request skipped because no auth cookie is present.");
      return {
        ok: true,
        status: 200,
        payload: null,
      };
    }

    const sessionEnvelope = await desktopSessionApiFetch(
      "/api/auth/session",
      { method: "GET" },
      { requireDesktopSession: true },
    );

    if (sessionEnvelope.ok) {
      debugDesktopInfo("[desktop-auth] session request resolved through desktop bootstrap session.");
      return sessionEnvelope;
    }

    const sessionErrorCode = resolveDesktopErrorCode(sessionEnvelope.payload);
    if (
      sessionErrorCode === "DESKTOP_TRAVEL_TOKEN_REQUIRED" ||
      sessionErrorCode === "DESKTOP_TRAVEL_TOKEN_INVALID"
    ) {
      debugDesktopWarn(
        `[desktop-auth] session request requires desktop travel token; cookie fallback disabled (${sessionErrorCode}).`,
      );
      return sessionEnvelope;
    }

    debugDesktopWarn(
      `[desktop-auth] session bootstrap failed, falling back to auth cookie session: ${extractDesktopApiErrorMessage(
        sessionEnvelope.payload,
        "Desktop auth session unavailable.",
      )}`,
    );

    const fallbackEnvelope = await fetchDesktopCookieSessionEnvelope();
    debugDesktopInfo(
      `[desktop-auth] session cookie fallback completed ok=${fallbackEnvelope.ok} status=${fallbackEnvelope.status}`,
    );
    return fallbackEnvelope;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:login", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const captchaToken = typeof payload.captchaToken === "string" ? payload.captchaToken : "";
    const rememberMe = payload.rememberMe === true;
    const travelToken = typeof payload.travelToken === "string" ? payload.travelToken.trim() : "";

    if (!email || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Credenciais invalidas." },
      };
    }

    desktopAuth.clearSessionState(true);
    await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
    if (travelToken) {
      desktopAuth.setPendingTravelToken(travelToken);
    }

    debugDesktopInfo(
      `[desktop-auth] login start email=${sanitizeSessionLogText(email, 120)} rememberMe=${rememberMe ? "yes" : "no"} travelToken=${travelToken ? "yes" : "no"}`,
    );

    const response = await desktopSessionApiFetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        captchaToken,
        rememberMe,
        desktopDeviceId: desktopAuth.getState().deviceId,
      }),
    }, { requireDesktopSession: false });

    debugDesktopInfo(
      `[desktop-auth] login response status=${response.status} ok=${response.ok} ${summarizeDesktopApiPayload(
        response.payload,
      )}`,
    );

    if (!response.ok) {
      await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
      desktopAuth.clearSessionState(true);
      return response;
    }

    try {
      await desktopAuth.registerDeviceKey("login", { travelToken });
      await desktopAuth.refreshToken("on-demand");
    } catch (error) {
      if (
        isDesktopStructuredError(error) &&
        (error.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED" ||
          error.code === "DESKTOP_TRAVEL_TOKEN_INVALID")
      ) {
        await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
        desktopAuth.clearSessionState(true);
        debugDesktopWarn(
          `[desktop-auth] post-login bootstrap requires travel token; returning auth error (${error.code}).`,
        );
        return toDesktopAuthErrorEnvelope(
          error,
          "Este dispositivo precisa de um token de viagem para entrar nesta conta.",
          error.code,
        );
      }

      debugDesktopWarn(
        `[desktop-auth] post-login bootstrap failed; continuing with cookie session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    debugDesktopInfo("[desktop-auth] login completed; renderer can refresh session snapshot.");

    return response;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:register", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const name = typeof payload.name === "string" ? payload.name : "";
    const captchaToken = typeof payload.captchaToken === "string" ? payload.captchaToken : "";
    const travelToken = typeof payload.travelToken === "string" ? payload.travelToken.trim() : "";
    const legalAcceptance =
      payload.legalAcceptance && typeof payload.legalAcceptance === "object" && !Array.isArray(payload.legalAcceptance)
        ? payload.legalAcceptance
        : undefined;

    if (!email || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Dados de registro invalidos." },
      };
    }

    const response = await desktopSessionApiFetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        name,
        captchaToken,
        legalAcceptance,
        desktopDeviceId: desktopAuth.getState().deviceId,
      }),
    }, { requireDesktopSession: false });

    debugDesktopInfo(
      `[desktop-auth] register response status=${response.status} ok=${response.ok} ${summarizeDesktopApiPayload(
        response.payload,
      )}`,
    );

    if (!response.ok) {
      return response;
    }

    try {
      if (travelToken) {
        desktopAuth.setPendingTravelToken(travelToken);
      }
      await desktopAuth.registerDeviceKey("register", { travelToken });
      await desktopAuth.refreshToken("on-demand");
    } catch (error) {
      if (
        isDesktopStructuredError(error) &&
        (error.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED" ||
          error.code === "DESKTOP_TRAVEL_TOKEN_INVALID")
      ) {
        await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
        desktopAuth.clearSessionState(true);
        debugDesktopWarn(
          `[desktop-auth] post-register bootstrap requires travel token; returning auth error (${error.code}).`,
        );
        return toDesktopAuthErrorEnvelope(
          error,
          "Este dispositivo precisa de um token de viagem para entrar nesta conta.",
          error.code,
        );
      }

      debugDesktopWarn(
        `[desktop-auth] post-register bootstrap failed; continuing with cookie session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return response;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:travel-token:set", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const rawToken = typeof payload.token === "string" ? payload.token.trim() : "";
    desktopAuth.setPendingTravelToken(rawToken.length > 0 ? rawToken : null);
    return {
      ok: true,
      status: 200,
      payload: {
        success: true,
      },
    };
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:travel-token:create", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const ttlMinutesRaw = Number(payload.ttlMinutes);
    const travelDaysRaw = Number(payload.travelDays);
    const requestBody: Record<string, unknown> = {};
    const deliveryMode =
      payload.deliveryMode === "email"
        ? "email"
        : payload.deliveryMode === "copy"
          ? "copy"
          : null;
    if (Number.isFinite(ttlMinutesRaw) && ttlMinutesRaw > 0) {
      requestBody.ttlMinutes = Math.trunc(ttlMinutesRaw);
    }
    if (Number.isFinite(travelDaysRaw) && travelDaysRaw > 0) {
      requestBody.travelDays = Math.trunc(travelDaysRaw);
    }
    if (deliveryMode) {
      requestBody.deliveryMode = deliveryMode;
    }

    return desktopSessionApiFetch(
      DESKTOP_TRAVEL_TOKEN_PATH,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      { requireDesktopSession: true },
    );
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:verify-email", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const accessToken = normalizeAccessToken(payload.accessToken);
    if (!accessToken) {
      return {
        ok: false,
        status: 401,
        payload: { error: "Sessao expirada. Faca login novamente." },
      };
    }

    return desktopSessionApiFetch("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:confirm-email", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    if (!token) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid token.", code: "AUTH_INVALID_TOKEN" },
      };
    }

    return desktopSessionApiFetch("/api/auth/confirm-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:forgot-password", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    if (!email) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid email." },
      };
    }

    return desktopSessionApiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:reset-password", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!token || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid token or password." },
      };
    }

    return desktopSessionApiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        password,
      }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:sign-out", async () => {
    const response = await desktopSessionApiFetch("/api/auth/sign-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }, { requireDesktopSession: false });

    await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
    desktopAuth.clearSessionState(true);
    return response;
  });

  // ─── v2 desktop shell contract: handlers that the Rust app exposes and the
  // ─── Electron shell did not previously register. They mirror the behaviour
  // ─── of the corresponding src-tauri commands.

  // auth:refresh-session — same flow as registerDesktopSessionToken
  // (POST to bootstrap with the device key or secret) to renew the session.
  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:refresh-session", async () => {
    await desktopAuth.registerSessionToken();
    return {
      ok: true,
      status: 200,
      payload: { refreshed: true, sessionId: desktopAuth.getState().sessionId },
    };
  });

  // identity: stable per-install id + HMAC fingerprint (the same data the
  // auth-server's desktop routes already consume).
  registerSecureIpcHandler("desktop-api:identity:hardware-id", async () => {
    return { hardwareId: resolveDesktopDeviceId() };
  });
  registerSecureIpcHandler("desktop-api:identity:machine-fingerprint", async () => {
    const deviceId = resolveDesktopDeviceId();
    // v1 does no hardware fingerprinting — the stable per-install id IS the fingerprint.
    return { fingerprint: deviceId };
  });

  // security: snapshot of the SHA-256 pins configured per host.
  registerSecureIpcHandler("desktop-api:security:cert-pinning:snapshot", async () => {
    const hosts: Record<string, string[]> = {};
    getCertificatePinsByHost(authApiUrl).forEach((pins, host) => {
      hosts[host] = Array.from(pins);
    });
    return { configured: Object.keys(hosts).length > 0, hosts };
  });

  // integrations: deep link (komastudio://) — same functions as the main
  // process's protocol flow.
  registerSecureIpcHandler("desktop-api:integrations:deep-link:extract", async (value) => {
    const payload = (value ?? {}) as { argv?: unknown };
    const argv = Array.isArray(payload.argv) ? payload.argv.map(String) : [];
    return { url: extractDeepLinkFromArgv(argv) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:route", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    return { hashRoute: deepLinkToHashRoute(url) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:format", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    return { formatted: formatDeepLinkForLog(url) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:navigate", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    navigateMainWindowFromDeepLink(url);
    return { navigated: true };
  });

  // images: folder listing (the v2 contract uses it in the model manager).
  registerSecureIpcHandler("desktop-api:images:list-folder", async (value) => {
    const payload = (value ?? {}) as { folderPath?: unknown };
    const folderPath = typeof payload.folderPath === "string" ? payload.folderPath : "";
    if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return { files: [] };
    }
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const full = path.join(folderPath, entry.name);
        return {
          name: entry.name,
          sizeBytes: fs.statSync(full).size,
          modifiedAt: fs.statSync(full).mtimeMs,
        };
      });
    return { folderPath, files };
  });

  // discord-rpc: clear activity (the class already supports it; the channel was missing).
  registerSecureIpcHandler("discord-rpc:clear-activity", async () => {
    return discordRPC.clearActivity();
  });

  // fonts: install/uninstall are not yet implemented in the electron shell —
  // return a typed error so the UI can degrade gracefully (parity with the
  // contract).
  registerSecureIpcHandler("desktop-api:fonts:install", async () => {
    return {
      ok: false,
      status: 501,
      payload: { error: "Font install is not supported by this shell yet." },
    };
  });
  registerSecureIpcHandler("desktop-api:fonts:uninstall", async () => {
    return {
      ok: false,
      status: 501,
      payload: { error: "Font uninstall is not supported by this shell yet." },
    };
  });
};

const resolveDevPythonRuntime = (
  profile: MiniBackendAccelerationProfile,
): { command: string; args: string[] } => {
  const override = (process.env.MINI_BACKEND_PYTHON ?? "").trim();
  if (override) {
    return { command: override, args: [] };
  }

  const localCandidatePaths = buildDevPythonRuntimePathCandidates(
    profile,
    process.cwd(),
    process.platform,
  );
  for (const candidatePath of localCandidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return { command: candidatePath, args: [] };
    }
  }

  const candidates =
    process.platform === "win32"
      ? [
          { command: "py", args: ["-3.12"] },
          { command: "python", args: [] },
        ]
      : [
          { command: "python3.12", args: [] },
          { command: "python3", args: [] },
          { command: "python", args: [] },
        ];

  const rootDir = process.cwd();
  for (const candidate of candidates) {
    if (canRunCommand(candidate.command, [...candidate.args, "-c", "import sys"], rootDir)) {
      return candidate;
    }
  }

  return candidates[0];
};

const ensureMiniBackendDevDependencies = (spec: MiniBackendCommandSpec): void => {
  if (!isDev || !spec.dependencyCheck || !spec.dependencyInstall) {
    return;
  }

  if (runCommand(spec.dependencyCheck)) {
    return;
  }

  console.warn(
    "[mini-backend] Dependencias de exportacao PSD ausentes. Instalando psd-tools e photoshop-python-api no runtime ativo...",
  );
  const installOk = runCommand(spec.dependencyInstall);
  if (!installOk) {
    console.error(
      `[mini-backend] Failed to install PSD dependencies automatically. Run manually: ${spec.dependencyInstall.command} ${spec.dependencyInstall.args.join(" ")}`,
    );
    return;
  }

  if (!runCommand(spec.dependencyCheck)) {
    console.error("[mini-backend] Dependencias PSD continuam indisponiveis apos instalacao automatica.");
  }
};

const getMiniBackendCommand = async (): Promise<MiniBackendCommandSpec> => {
  const profile = await resolveMiniBackendAccelerationProfile();
  if (isDev) {
    const runtime = resolveDevPythonRuntime(profile);
    // monorepo: the mini-backend source lives in packages/mini-backend
    const miniBackendDir = path.join(process.cwd(), "..", "..", "packages", "mini-backend");
    const appPath = path.join(miniBackendDir, "app.py");
    runtimeStore.patch({
      requestedProfile: profile,
      activeProfile: profile,
      source: "bundled-core",
      installDir: miniBackendDir,
      version: app.getVersion(),
      lastError: null,
      status: "checking",
      statusMessage: "Starting local development runtime.",
      attempt: 0,
      maxAttempts: 0,
      progress: null,
    });
    const dependencyCheck: CommandSpec = {
      command: runtime.command,
      args: [...runtime.args, "-c", "import psd_tools, photoshop"],
      cwd: miniBackendDir,
    };
    const dependencyInstall: CommandSpec = {
      command: runtime.command,
      args: [
        ...runtime.args,
        "-m",
        "pip",
        "install",
        "psd-tools>=1.12.0",
        "photoshop-python-api>=0.24.1",
        "pywin32>=306",
      ],
      cwd: miniBackendDir,
    };

    return {
      command: runtime.command,
      args: [...runtime.args, appPath],
      cwd: process.cwd(),
      dependencyCheck,
      dependencyInstall,
      env: {
        MINI_BACKEND_ACCELERATION_PROFILE: profile,
        // DEV: same env contract as the production spawn — without it the
        // backend runs blind (no models/reference images) and the profile
        // warmup fails.
        KOMA_MODELS_ROOT: path.join(app.getPath("userData"), "models"),
        KOMA_APP_RESOURCES_DIR: path.join(process.cwd(), "resources"),
        KOMA_REFERENCE_IMAGES_DIR: path.join(process.cwd(), "resources", "reference_images"),
      },
      runtimeSource: "bundled-core",
      installDir: miniBackendDir,
      version: app.getVersion(),
    };
  }

  const manifest = readPackagedMiniBackendManifest();
  const selectedRuntime = readMiniBackendRuntimeSelection(app.getPath("userData"));
  const selectedRuntimeBinaryPath = resolveSelectedRuntimeBinaryPath(app.getPath("userData"));
  if (selectedRuntime && selectedRuntime.profile === profile && selectedRuntimeBinaryPath) {
    return {
      command: selectedRuntimeBinaryPath,
      args: [],
      cwd: path.dirname(selectedRuntimeBinaryPath),
      env: {
        MINI_BACKEND_ACCELERATION_PROFILE: profile,
      },
      runtimeSource: "downloaded-runtime",
      installDir: path.dirname(selectedRuntimeBinaryPath),
      version: selectedRuntime.version,
    };
  }

  const manifestEntry = manifest ? resolveManifestEntry(manifest, profile) : null;
  const binaryPath = resolvePackagedMiniBackendBinary(manifestEntry?.entry);
  runtimeStore.patch({
    requestedProfile: profile,
    activeProfile: manifestEntry?.profile ?? "cpu",
    source: "bundled-core",
    runtimeManifestUrl: resolveMiniBackendRuntimeManifestUrl(),
    runtimeArchiveUrl: null,
    installDir: path.dirname(binaryPath),
    version: app.getVersion(),
    lastError: runtimeStore.getState().lastError,
    status:
      runtimeStore.getState().lastError || (manifestEntry?.profile ?? "cpu") !== profile
        ? "fallback"
        : "ready",
    statusMessage:
      runtimeStore.getState().lastError || (manifestEntry?.profile ?? "cpu") !== profile
        ? "Running with embedded fallback runtime."
        : "Embedded runtime ready.",
    attempt: 0,
    maxAttempts: 0,
    progress: null,
  });
    return {
      command: binaryPath,
      args: [],
      cwd: path.dirname(binaryPath),
      env: {
        MINI_BACKEND_ACCELERATION_PROFILE: manifestEntry?.env.MINI_BACKEND_ACCELERATION_PROFILE ?? profile,
        ...manifestEntry?.env,
      },
      runtimeSource: "bundled-core",
      installDir: path.dirname(binaryPath),
      version: app.getVersion(),
    };
  };

const getRandomLocalPort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = nodeNet.createServer();
    server.once("error", (error) => {
      reject(error);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate random local port")));
        return;
      }

      const port = address.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });

const waitForMiniBackend = async (
  baseUrl: string,
  {
    attempts = 20,
    delayMs = 500,
  }: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // backend still booting
    }

    await sleep(delayMs);
  }

  return false;
};

const syncMiniBackendRuntimeStateFromApi = async (): Promise<void> => {
  if (!localApiUrl || !localApiSessionSecret) {
    return;
  }

  try {
    const response = await fetch(`${localApiUrl}/device/info`, {
      method: "GET",
      headers: {
        [LOCAL_API_SESSION_HEADER]: localApiSessionSecret,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as MiniBackendDeviceInfoPayload;
    const requestedProfileOverride = normalizeAccelerationProfileOverride(payload.profile);
    const requestedProfile = requestedProfileOverride === "auto"
      ? runtimeStore.getState().requestedProfile
      : (requestedProfileOverride as MiniBackendAccelerationProfile);
    const activeProfileOverride = normalizeAccelerationProfileOverride(payload.active_profile);
    const activeProfile = activeProfileOverride !== "auto"
      ? (activeProfileOverride as MiniBackendAccelerationProfile)
      : resolveEffectiveAccelerationProfile({
        requestedProfile,
        provider: payload.provider,
      });
    const fallbackReason = formatRuntimeFallbackReason(payload.fallback_reason);

    runtimeStore.patch({
      requestedProfile,
      activeProfile,
      lastError: fallbackReason,
      gpuName: typeof payload.name === "string" && payload.name.trim().length > 0 ? payload.name : null,
      vramGb: typeof payload.vram_gb === "number" && payload.vram_gb > 0 ? payload.vram_gb : null,
      status: fallbackReason ? "fallback" : "ready",
      statusMessage: fallbackReason,
    });
  } catch {
    // Best-effort sync only.
  }
};

const waitForMiniBackendProcessExit = async (
  exitPromise: Promise<void> | null,
  timeoutMs: number,
): Promise<boolean> => {
  if (!exitPromise) {
    return true;
  }

  try {
    return await Promise.race([
      exitPromise.then(() => true),
      sleep(timeoutMs).then(() => false),
    ]);
  } catch {
    return false;
  }
};

const normalizeRuntimeArtifactsBaseUrl = (rawUrl: string | null): string | null => {
  if (!rawUrl) {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const resolveMiniBackendRuntimeManifestUrl = (): string | null => {
  const configuredUrl = normalizeRuntimeArtifactsBaseUrl(miniBackendArtifactsUrl);
  if (!configuredUrl) {
    return null;
  }

  if (configuredUrl.toLowerCase().endsWith(".json")) {
    return configuredUrl;
  }

  if (configuredUrl.toLowerCase().includes("/mini-backend-artifacts/")) {
    return `${configuredUrl}latest.json`;
  }

  return `${configuredUrl}mini-backend-artifacts/latest.json`;
};

const resolveMiniBackendRuntimeUrl = (manifestUrl: string, relativeUrl: string): string => {
  return new URL(relativeUrl, manifestUrl).toString();
};

const computeSha512Base64ForFile = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });

const readMiniBackendRuntimeManifest = async (
  { silent = false }: { silent?: boolean } = {},
): Promise<MiniBackendRuntimeArtifactManifest | null> => {
  const manifestUrl = resolveMiniBackendRuntimeManifestUrl();
  if (!manifestUrl) {
    return null;
  }

  try {
    if (!silent) {
      runtimeStore.patch({
        status: "checking",
        statusMessage: "Checking runtime artifact manifest.",
        runtimeManifestUrl: manifestUrl,
      });
    }
    const response = await runWithRetry({
      retryCount: RUNTIME_DOWNLOAD_RETRY_COUNT,
      isRetryable: isRetryableRuntimeDownloadError,
      onRetry: ({ attempt, delayMs, error }) => {
        if (!silent) {
          runtimeStore.patch({
            status: "checking",
            statusMessage: `Retrying runtime manifest request (${attempt + 1}/${RUNTIME_DOWNLOAD_RETRY_COUNT + 1}) in ${Math.max(1, Math.ceil(delayMs / 1000))}s.`,
            lastError: error instanceof Error ? error.message : String(error),
            attempt: Math.min(RUNTIME_DOWNLOAD_RETRY_COUNT + 1, attempt + 1),
            maxAttempts: RUNTIME_DOWNLOAD_RETRY_COUNT + 1,
          });
        }
      },
      operation: () => fetch(manifestUrl, {
        method: "GET",
        signal: AbortSignal.timeout(30_000),
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid runtime manifest payload");
    }

    return payload as MiniBackendRuntimeArtifactManifest;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!silent) {
      runtimeStore.patch({
        status: "checking",
        statusMessage: "Checking runtime artifact manifest.",
        runtimeManifestUrl: manifestUrl,
        lastError: `Failed to read runtime manifest: ${message}`,
      });
    }
    return null;
  }
};

const getMiniBackendRuntimeInstallDir = (
  version: string,
  profile: MiniBackendAccelerationProfile,
): string =>
  path.join(
    app.getPath("userData"),
    "mini-backend-runtimes",
    version,
    sanitizeMiniBackendProfile(profile),
  );

const isMiniBackendRuntimeInstalled = (
  version: string,
  profile: MiniBackendAccelerationProfile,
  entry: string,
): boolean => fs.existsSync(path.join(getMiniBackendRuntimeInstallDir(version, profile), entry));

const listMiniBackendRuntimeArtifacts = async (): Promise<MiniBackendRuntimeArtifactOption[]> => {
  const manifest = await readMiniBackendRuntimeManifest({ silent: true });
  if (!manifest) {
    return [];
  }

  const recommendedProfile = await resolveMiniBackendAccelerationProfile({ silent: true, ignoreManualSelection: true });
  const installedProfiles = Object.values(manifest.profiles)
    .filter((entry): entry is MiniBackendRuntimeArtifactRecord => Boolean(entry))
    .flatMap((entry) => (
      isMiniBackendRuntimeInstalled(manifest.version, entry.profile, entry.entry)
        ? [entry.profile]
        : []
    ));

  return listMiniBackendRuntimeArtifactOptions({
    manifest,
    recommendedProfile,
    installedProfiles,
  });
};

const downloadRuntimeArtifactToDisk = async (
  profile: MiniBackendAccelerationProfile,
  record: MiniBackendRuntimeArtifactRecord,
  downloadUrl: string,
  outputPath: string,
): Promise<void> => {
  const maxAttempts = RUNTIME_DOWNLOAD_RETRY_COUNT + 1;
  let currentAttempt = 0;

  await runWithRetry({
    retryCount: RUNTIME_DOWNLOAD_RETRY_COUNT,
    isRetryable: isRetryableRuntimeDownloadError,
    onRetry: ({ attempt, delayMs, error }) => {
      const nextAttempt = Math.min(maxAttempts, attempt + 1);
      runtimeStore.patch({
        status: "downloading",
        statusMessage: `Retrying ${profile} runtime download (${nextAttempt}/${maxAttempts}) in ${Math.max(1, Math.ceil(delayMs / 1000))}s.`,
        lastError: error instanceof Error ? error.message : String(error),
        attempt: nextAttempt,
        maxAttempts,
      });
    },
    operation: async () => {
      currentAttempt += 1;
      runtimeStore.patch({
        status: "downloading",
        statusMessage:
          (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0)
            ? `Resuming ${profile} runtime download (${currentAttempt}/${maxAttempts}).`
            : `Downloading ${profile} runtime (${currentAttempt}/${maxAttempts}).`,
        lastError: null,
        attempt: currentAttempt,
        maxAttempts,
        progress: {
          transferredBytes: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
          totalBytes: Math.max(0, record.size),
          percent: record.size > 0 && fs.existsSync(outputPath)
            ? Math.max(0, Math.min(100, (fs.statSync(outputPath).size / record.size) * 100))
            : 0,
          speedBytesPerSecond: 0,
        },
      });

      await downloadUrlToFileWithResume(downloadUrl, outputPath, {
        expectedTotalBytes: record.size,
        fetchImpl: (url, init) => fetch(url, {
          ...init,
          signal: AbortSignal.timeout(resolveRuntimeTransferTimeoutMs(record.size)),
        }),
        onProgress: (progress) => {
          runtimeStore.patch({
            status: "downloading",
            progress,
            attempt: currentAttempt,
            maxAttempts,
            lastError: null,
          });
        },
      });
    },
  });
};

const extractRuntimeArchive = async (archivePath: string, destinationDir: string): Promise<void> => {
  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(destinationDir, { recursive: true });

  if (process.platform === "win32") {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Expand-Archive",
        "-LiteralPath",
        archivePath,
        "-DestinationPath",
        destinationDir,
        "-Force",
      ],
      {
        stdio: "ignore",
        windowsHide: true,
        timeout: RUNTIME_ARCHIVE_EXTRACT_TIMEOUT_MS,
      },
    );
    return;
  }

  throw new Error("Runtime archive extraction is currently supported only on Windows builds.");
};

const ensureMiniBackendDownloadedRuntime = async (
  profile: MiniBackendAccelerationProfile,
  { allowCpuDownload = false }: { allowCpuDownload?: boolean } = {},
): Promise<{
  binaryPath: string;
  installDir: string;
  version: string;
  archiveUrl: string;
} | null> => {
  if (isDev || (profile === "cpu" && !allowCpuDownload)) {
    return null;
  }

  const manifest = await readMiniBackendRuntimeManifest();
  const manifestUrl = resolveMiniBackendRuntimeManifestUrl();
  if (!manifest || !manifestUrl) {
    return null;
  }

  const record = manifest.profiles?.[profile] as MiniBackendRuntimeArtifactRecord | undefined;
  if (!record) {
    runtimeStore.patch({
      status: "fallback",
      statusMessage: `Runtime profile not available in manifest: ${profile}`,
      runtimeManifestUrl: manifestUrl,
      lastError: `Runtime profile not available in manifest: ${profile}`,
    });
    return null;
  }

  const installDir = getMiniBackendRuntimeInstallDir(manifest.version, profile);
  const binaryPath = path.join(installDir, record.entry);
  const archiveUrl = resolveMiniBackendRuntimeUrl(manifestUrl, record.url);
  if (fs.existsSync(binaryPath)) {
    runtimeStore.patch({
      requestedProfile: profile,
      activeProfile: profile,
      source: "downloaded-runtime",
      runtimeManifestUrl: manifestUrl,
      runtimeArchiveUrl: archiveUrl,
      installDir,
      version: manifest.version,
      lastError: null,
      status: "ready",
      statusMessage: `${profile} runtime ready.`,
      attempt: 0,
      maxAttempts: 0,
      progress: null,
    });
    return {
      binaryPath,
      installDir,
      version: manifest.version,
      archiveUrl,
    };
  }

  const tempDir = path.join(app.getPath("temp"), "koma-runtime-downloads");
  const tempZipPath = path.join(tempDir, record.fileName);
  const tempExtractDir = `${installDir}.tmp`;

  try {
    ensureMiniBackendRuntimeDiskSpace(tempZipPath, installDir, record.size);
    await downloadRuntimeArtifactToDisk(profile, record, archiveUrl, tempZipPath);
    runtimeStore.patch({
      status: "verifying",
      statusMessage: `Verifying ${profile} runtime archive.`,
    });
    const currentSha512 = await computeSha512Base64ForFile(tempZipPath);
    if (currentSha512 !== record.sha512) {
      throw new Error("Runtime archive sha512 mismatch.");
    }

    runtimeStore.patch({
      status: "extracting",
      statusMessage: `Installing ${profile} runtime.`,
    });
    await extractRuntimeArchive(tempZipPath, tempExtractDir);
    fs.rmSync(installDir, { recursive: true, force: true });
    fs.renameSync(tempExtractDir, installDir);

    runtimeStore.patch({
      requestedProfile: profile,
      activeProfile: profile,
      source: "downloaded-runtime",
      runtimeManifestUrl: manifestUrl,
      runtimeArchiveUrl: archiveUrl,
      installDir,
      version: manifest.version,
      lastError: null,
      status: "ready",
      statusMessage: `${profile} runtime installed successfully.`,
      progress: null,
      attempt: 0,
      maxAttempts: 0,
    });
    return {
      binaryPath,
      installDir,
      version: manifest.version,
      archiveUrl,
    };
  } catch (error) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    runtimeStore.patch({
      requestedProfile: profile,
      activeProfile: "cpu",
      source: "bundled-core",
      runtimeManifestUrl: manifestUrl,
      runtimeArchiveUrl: archiveUrl,
      installDir: null,
      version: manifest.version,
      lastError: message,
      status: "fallback",
      statusMessage: `Failed to install ${profile} runtime. Falling back to the embedded runtime.`,
      progress: null,
    });
    console.warn(`[mini-backend-runtime] ${message}`);
    return null;
  } finally {
    if (fs.existsSync(binaryPath)) {
      fs.rmSync(tempZipPath, { force: true });
    }
  }
};

const forceStopMiniBackendProcess = (processRef: ChildProcess | null): void => {
  if (!processRef || processRef.killed) {
    return;
  }

  const pid = processRef.pid;
  if (process.platform === "win32" && typeof pid === "number" && Number.isInteger(pid) && pid > 0) {
    try {
      execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        timeout: 3_000,
      });
      return;
    } catch {
      // Fall back to generic kill below.
    }
  }

  try {
    processRef.kill("SIGKILL");
  } catch {
    // Ignore process termination race conditions.
  }
};

const startMiniBackend = async (): Promise<void> => {
  await prepareMiniBackendLaunchContext();
  const commandSpec = await getMiniBackendCommand();
  const { command, args, cwd } = commandSpec;
  ensureMiniBackendDevDependencies(commandSpec);
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

  miniBackendProcess = spawn(command, args, {
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
  miniBackendProcessForExitCleanup = miniBackendProcess;

  const shouldIgnoreMiniBackendProgressNoise = (rawText: string): boolean => {
    const text = rawText.trim();
    if (!text) {
      return true;
    }
    return (
      /Progress:\s*\|/i.test(text) ||
      /onnxruntime is not built with CUDA 12\.x support/i.test(text)
    );
  };

  const decodeMiniBackendChunk = (chunk: Buffer): string => {
    const utf8 = chunk.toString("utf8");
    if (!utf8.includes("\uFFFD")) {
      return utf8;
    }

    // Some Windows-native provider stacks emit non-UTF8 bytes on stderr.
    // Prefer a permissive decode so diagnostics keep flowing instead of
    // polluting the app with unreadable chunks.
    return chunk.toString("latin1");
  };

  const syncMiniBackendRuntimeStateFromLog = (rawText: string): void => {
    const text = rawText.trim();
    if (!text) {
      return;
    }

    const warmupFallbackReason = formatRuntimeFallbackReason("runtime_warmup_fallback_to_cpu");

    // These must stay in sync with the English log markers emitted by
    // packages/mini-backend/app.py (guarded by
    // ../tests/mini-backend-fallback-markers.test.ts).
    if (text.includes("Falling back to CPU automatically")) {
      runtimeStore.patch({
        activeProfile: "cpu",
        lastError: warmupFallbackReason,
        status: "fallback",
        statusMessage: warmupFallbackReason,
      });
      return;
    }

    if (text.includes("Detector warmup successfully redone on CPU")) {
      runtimeStore.patch({
        activeProfile: "cpu",
        lastError: warmupFallbackReason,
        status: "fallback",
        statusMessage: warmupFallbackReason,
      });
    }
  };

  miniBackendProcess.stdout?.on("data", (chunk: Buffer) => {
    const text = decodeMiniBackendChunk(chunk);
    if (shouldIgnoreMiniBackendProgressNoise(text)) {
      return;
    }
    miniBackendRuntimeLog.push("stdout", text);
    syncMiniBackendRuntimeStateFromLog(text);
    console.log(`[mini-backend] ${text.trim()}`);
  });

  miniBackendProcess.stderr?.on("data", (chunk: Buffer) => {
    const text = decodeMiniBackendChunk(chunk);
    if (shouldIgnoreMiniBackendProgressNoise(text)) {
      return;
    }
    miniBackendRuntimeLog.push("stderr", text);
    syncMiniBackendRuntimeStateFromLog(text);
    console.error(`[mini-backend:err] ${text.trim()}`);
  });

  const currentProcess = miniBackendProcess;
  const currentExitPromise = new Promise<void>((resolve) => {
    currentProcess.once("exit", () => {
      resolve();
    });
  });
  miniBackendExitPromise = currentExitPromise;
  miniBackendProcess.on("exit", (code) => {
    console.log(`[mini-backend] exited with code ${code ?? "unknown"}`);
    if (miniBackendProcess === currentProcess) {
      miniBackendProcess = null;
    }
    if (miniBackendProcessForExitCleanup === currentProcess) {
      miniBackendProcessForExitCleanup = null;
    }
    if (miniBackendExitPromise === currentExitPromise) {
      miniBackendExitPromise = null;
    }
  });

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
    return;
  }
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

const setupDesktopClientHeaderInjection = (window: BrowserWindow): void => {
  let authOrigin = "";
  let localOrigin = "";
  try {
    authOrigin = new URL(authApiUrl).origin;
    localOrigin = new URL(localApiUrl).origin;
  } catch {
    return;
  }

  // Intercept outgoing requests to inject desktop client headers and strip Origin.
  // Removing Origin prevents servers that don't have "app://local" in ALLOWED_ORIGINS
  // from rejecting the preflight or request with a CORS error.
  window.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ["*://*/*"] },
    (details, callback) => {
      try {
        const targetUrl = new URL(details.url);
        const targetsDesktopSession = targetUrl.origin === authOrigin;
        const targetsLocalBackend = targetUrl.origin === localOrigin;
        const isPreflightRequest = details.method.toUpperCase() === "OPTIONS";

        if (targetsDesktopSession) {
          // Strip Origin on both the actual request and the Authorization preflight.
          // Packaged renderer requests come from app://local and can otherwise trip
          // server-side origin allowlists before our response-header patch runs.
          delete details.requestHeaders["Origin"];
          delete details.requestHeaders["origin"];
        }

        if (!isPreflightRequest && targetsDesktopSession) {
          const nowMs = Date.now();
          if (
            desktopAuth.getState().token &&
            desktopAuth.getState().expiresAtMs - nowMs <= desktopClientTokenRefreshSkewSec * 1_000
          ) {
            void desktopAuth.refreshToken("on-demand");
          }

          if (desktopAuth.getState().token) {
            details.requestHeaders[DESKTOP_CLIENT_TOKEN_HEADER] = desktopAuth.getState().token;
            details.requestHeaders[DESKTOP_SESSION_ID_HEADER] = desktopAuth.getState().sessionId;
            details.requestHeaders[DESKTOP_DEVICE_ID_HEADER] = desktopAuth.getState().deviceId;
          }
          details.requestHeaders[DESKTOP_APP_VERSION_HEADER] = app.getVersion();
          details.requestHeaders[DESKTOP_UPDATE_CHANNEL_HEADER] = getDesktopUpdateChannel(app.getVersion());

        }

        if (!isPreflightRequest && localApiSessionSecret && targetsLocalBackend) {
          details.requestHeaders[LOCAL_API_SESSION_HEADER] = localApiSessionSecret;
        }
      } catch {
        // ignore malformed URL
      } finally {
        // Always call callback – if the obfuscated control flow ever skips the
        // normal exit path, the finally block guarantees the request proceeds.
        callback({ requestHeaders: details.requestHeaders });
      }
    },
  );

  // Inject CORS response headers for auth API responses so the renderer
  // accepts them. Since we strip Origin from the request, the server won't add
  // Access-Control-Allow-Origin itself, so we add it here.
  const fallbackDesktopOrigin = `${INTERNAL_APP_PROTOCOL}://${INTERNAL_APP_HOST}`;
  const desktopSessionUrls = [
    `${authOrigin}/*`,
  ].filter((u) => u !== "/*");

  if (desktopSessionUrls.length > 0) {
    window.webContents.session.webRequest.onHeadersReceived(
      { urls: desktopSessionUrls },
      (details, callback) => {
        const headers = { ...details.responseHeaders };
        try {
          // Determine the actual origin. In DEV, this may be http://localhost:5173 
          // while in PROD it is app://local. It must exactly match the renderer's origin
          // because we use Access-Control-Allow-Credentials: true.
          let currentOrigin = fallbackDesktopOrigin;
          try {
            const currentUrl = window.webContents.getURL();
            if (currentUrl) {
              currentOrigin = resolveRendererCorsOrigin(currentUrl, fallbackDesktopOrigin);
            }
          } catch {
            // keep fallback
          }

          // Inject CORS headers so the renderer accepts responses from the auth server.
          delete headers["access-control-allow-origin"];
          delete headers["Access-Control-Allow-Origin"];
          delete headers["access-control-allow-credentials"];
          delete headers["Access-Control-Allow-Credentials"];
          delete headers["access-control-allow-headers"];
          delete headers["Access-Control-Allow-Headers"];
          delete headers["access-control-allow-methods"];
          delete headers["Access-Control-Allow-Methods"];

          headers["access-control-allow-origin"] = [currentOrigin];
          headers["access-control-allow-credentials"] = ["true"];
          headers["access-control-allow-headers"] = ["*"];
          headers["access-control-allow-methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"];

          // Rewrite Set-Cookie headers to use SameSite=None; Secure so session
          // cookies are sent on cross-origin requests from app://local.
          // Without this, SameSite=Lax cookies are blocked on subsequent requests.
          const rawCookies =
            headers["set-cookie"] ?? headers["Set-Cookie"] ?? [];
          if (rawCookies.length > 0) {
            const patched = rawCookies.map((cookie: string) => {
              // Replace any existing SameSite value with None
              let c = cookie.replace(/;\s*SameSite=\w+/gi, "");
              c += "; SameSite=None";
              // SameSite=None requires Secure
              if (!/;\s*Secure/i.test(c)) {
                c += "; Secure";
              }
              return c;
            });
            headers["set-cookie"] = patched;
            delete headers["Set-Cookie"];
          }
        } catch {
          // ignore errors — callback must always be called
        } finally {
          callback({ responseHeaders: headers });
        }
      },
    );
  }
};

const setupNavigationHardening = (window: BrowserWindow): void => {
  const internalOrigin = getDevServerOrigin();

  const isInternalUrl = (targetUrl: string): boolean => {
    if (!internalOrigin) {
      return isInternalAppUrl(targetUrl);
    }

    try {
      return new URL(targetUrl).origin === internalOrigin;
    } catch {
      return false;
    }
  };

  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (isInternalUrl(targetUrl)) {
      return;
    }

    event.preventDefault();
    if (isAllowedExternalUrl(targetUrl)) {
      void shell.openExternal(targetUrl);
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
};

const createWindow = async (): Promise<void> => {
  await prepareMiniBackendLaunchContext();
  if (!isAuthDisabled && (await hasDesktopAuthCookie(authApiUrl, getDesktopHttpSession()))) {
    try {
      await desktopAuth.registerDeviceKey("startup");
      await desktopAuth.ensureToken("startup");
    } catch (error) {
      if (
        isDesktopStructuredError(error) &&
        (error.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED" || error.code === "DESKTOP_TRAVEL_TOKEN_INVALID")
      ) {
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
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
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

const stopMiniBackend = async (): Promise<void> => {
  if (miniBackendShutdownPromise) {
    await miniBackendShutdownPromise;
    return;
  }

  const processRef = miniBackendProcess;
  const exitPromise = miniBackendExitPromise;
  miniBackendProcess = null;
  miniBackendExitPromise = null;

  if (!processRef || processRef.killed) {
    return;
  }

  miniBackendShutdownPromise = (async () => {
    try {
      processRef.kill("SIGTERM");
    } catch {
      // Ignore process termination race conditions.
    }

    const exitedGracefully = await waitForMiniBackendProcessExit(exitPromise, 2_500);
    if (exitedGracefully) {
      return;
    }

    forceStopMiniBackendProcess(processRef);
    await waitForMiniBackendProcessExit(exitPromise, 2_000);
  })();

  try {
    await miniBackendShutdownPromise;
  } finally {
    miniBackendShutdownPromise = null;
  }
};

const gotTheLock = app.requestSingleInstanceLock();

// Module-based IPC handler registration
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
  getDesktopUpdateChannel: () => getDesktopUpdateChannel(app.getVersion()),
  miniBackendRuntimeLogBuffer: miniBackendRuntimeLog.getEntries(),
  miniBackendProcessRef: () => miniBackendProcess,
  authApiUrl,
  localApiUrl,
});
setupDesktopAuthIpcHandlers();
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
  forceStopMiniBackendProcess(miniBackendProcessForExitCleanup);
  miniBackendProcessForExitCleanup = null;
  miniBackendProcess = null;
  miniBackendExitPromise = null;
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
  void discordRPC.disconnect();
  desktopAuth.clearTokenRefreshTimeout();
  void stopMiniBackend().finally(() => {
    app.quit();
  });
});

app.on("before-quit", (event) => {
  void discordRPC.disconnect();
  desktopAuth.clearTokenRefreshTimeout();
  if (miniBackendProcess && !miniBackendProcess.killed) {
    event.preventDefault();
    void stopMiniBackend().finally(() => {
      app.quit();
    });
  }
});
