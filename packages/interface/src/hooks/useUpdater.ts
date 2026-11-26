import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { getDesktopAppVersion } from "../config/desktopClient";
import { useI18n } from "../i18n";
import { fetchWithTimeoutAndRetry } from "../utils/http";

import { desktopBridge } from "@/lib/desktop-bridge";

import { useInstallerUpdaterBridge } from "./useInstallerUpdaterBridge";
import type {
  UpdaterChannel,
  UpdaterProgress,
  UpdaterState,
  UpdaterStatus,
} from "../types";

const GITHUB_OWNER = "klaus-2";
const GITHUB_REPO = "koma-studio";

const BETA_TAG_PATTERN = /^v\d+\.\d+\.\d+-beta\.\d+$/;
const STABLE_TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

const UPDATER_BRIDGE_UNAVAILABLE = "Installer updater bridge is unavailable.";

const installFailureMessage = (error: unknown): string =>
  error instanceof Error
    ? `Failed to install the update: ${error.message}`
    : "Failed to install the update.";

const CHANNEL_STORAGE_KEY = "updater-channel";
const CHANNEL_STORAGE_EXPLICIT_KEY = "updater-channel-explicit";
const CHECK_DELAY_MS = 8_000;
const PERIODIC_CHECK_MS = 4 * 60 * 60 * 1_000;
const FOCUS_COOLDOWN_MS = 30 * 60 * 1_000;
// api.github.com allows 60 req/h per IP unauthenticated — back off before retrying.
const MAX_BACKOFF_ATTEMPTS = 4;

const ZERO_PROGRESS: UpdaterProgress = Object.freeze({
  percent: 0,
  transferred: 0,
  total: 0,
  speed: 0,
});

const DEFAULT_UPDATER_CHANNEL: UpdaterChannel = "stable";

const hasExplicitChannelChoice = (): boolean =>
  localStorage.getItem(CHANNEL_STORAGE_EXPLICIT_KEY) === "true";

const createInitialState = (): UpdaterState => {
  const currentVersion = getDesktopAppVersion();

  return {
    status: "idle",
    currentVersion,
    newVersion: null,
    mandatory: false,
    blocking: false,
    blockingReason: null,
    releaseNotes: null,
    channel: DEFAULT_UPDATER_CHANNEL,
    provider: "github",
    autoInstallOnQuit: false,
    allowPrerelease: false,
    progress: null,
    checkedAt: null,
    downloadedAt: null,
    error: null,
  };
};

const areProgressEqual = (left: UpdaterProgress | null, right: UpdaterProgress | null): boolean => {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return (
    left.percent === right.percent &&
    left.transferred === right.transferred &&
    left.total === right.total &&
    left.speed === right.speed
  );
};

const areUpdaterStatesEqual = (left: UpdaterState, right: UpdaterState): boolean =>
  left.status === right.status &&
  left.currentVersion === right.currentVersion &&
  left.newVersion === right.newVersion &&
  left.mandatory === right.mandatory &&
  left.blocking === right.blocking &&
  left.blockingReason === right.blockingReason &&
  left.releaseNotes === right.releaseNotes &&
  left.channel === right.channel &&
  left.provider === right.provider &&
  left.autoInstallOnQuit === right.autoInstallOnQuit &&
  left.allowPrerelease === right.allowPrerelease &&
  areProgressEqual(left.progress, right.progress) &&
  left.checkedAt === right.checkedAt &&
  left.downloadedAt === right.downloadedAt &&
  left.error === right.error;

const updaterStateReducer = (state: UpdaterState, patch: Partial<UpdaterState>): UpdaterState => {
  const nextState = { ...state, ...patch };

  return areUpdaterStatesEqual(state, nextState) ? state : nextState;
};

const isUpdaterChannel = (value: string | null): value is UpdaterChannel =>
  value === "stable" || value === "beta";

interface GithubReleasePayload {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
}

interface StaticReleaseManifestPayload {
  schemaVersion?: number;
  version?: string;
  channel?: string;
  releaseNotes?: string | null;
}

const isStaticManifestPayload = (value: unknown): value is StaticReleaseManifestPayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === 1 && typeof candidate.version === "string";
};

const normalizeVersion = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return value.trim().replace(/^v/i, "");
};

const comparePrereleaseIdentifier = (left: string, right: string): number => {
  const leftIsNumeric = /^\d+$/.test(left);
  const rightIsNumeric = /^\d+$/.test(right);
  if (leftIsNumeric && rightIsNumeric) {
    const leftValue = Number(left);
    const rightValue = Number(right);
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
    return 0;
  }
  if (leftIsNumeric) {
    return -1;
  }
  if (rightIsNumeric) {
    return 1;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const comparePrerelease = (left: string, right: string): number => {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const longest = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < longest; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    const result = comparePrereleaseIdentifier(leftPart, rightPart);
    if (result !== 0) {
      return result;
    }
  }
  return 0;
};

export const compareVersions = (a: string, b: string): number => {
  const parseVersion = (version: string): { numbers: number[]; prerelease: string | null } => {
    const [base = "", prereleaseRaw] = version.split("-", 2);
    const numbers = base
      .split(".")
      .map((part) => Number(part))
      .map((part) => (Number.isFinite(part) ? part : 0));
    while (numbers.length < 3) {
      numbers.push(0);
    }
    return {
      numbers,
      prerelease: prereleaseRaw?.trim() ? prereleaseRaw.trim() : null,
    };
  };

  const left = parseVersion(normalizeVersion(a));
  const right = parseVersion(normalizeVersion(b));

  for (let index = 0; index < 3; index += 1) {
    const leftValue = left.numbers[index] ?? 0;
    const rightValue = right.numbers[index] ?? 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  if (!left.prerelease && right.prerelease) {
    return 1;
  }
  if (left.prerelease && !right.prerelease) {
    return -1;
  }
  if (!left.prerelease && !right.prerelease) {
    return 0;
  }

  return comparePrerelease(left.prerelease ?? "", right.prerelease ?? "");
};

const buildReleasePageUrl = (
  channel: UpdaterChannel,
  version: string | null,
): string => {
  const base = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
  if (version && version.trim().length > 0) {
    const normalized = normalizeVersion(version);
    return `${base}/tag/v${normalized}`;
  }
  if (channel === "stable") {
    return `${base}/latest`;
  }
  return base;
};

const parseGithubReleaseJson = (
  raw: unknown,
  channel: UpdaterChannel,
): GithubReleasePayload | null => {
  if (isStaticManifestPayload(raw) && raw.version) {
    const version = normalizeVersion(raw.version);
    return {
      tag_name: `v${version}`,
      name: `KOMA Studio ${version}`,
      body: typeof raw.releaseNotes === "string" ? raw.releaseNotes : undefined,
      html_url: buildReleasePageUrl(channel, version),
      draft: false,
      prerelease: raw.channel === "beta",
    };
  }
  if (Array.isArray(raw)) {
    const releases = raw as GithubReleasePayload[];
    const match = releases.find(
      (release) =>
        !release.draft &&
        typeof release.tag_name === "string" &&
        (BETA_TAG_PATTERN.test(release.tag_name) || STABLE_TAG_PATTERN.test(release.tag_name)),
    );
    return match ?? null;
  }
  if (raw && typeof raw === "object") {
    return raw as GithubReleasePayload;
  }
  return null;
};

const staticManifestUrlForChannel = (channel: UpdaterChannel): string =>
  channel === "beta"
    ? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/beta/koma-release-manifest.json`
    : `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/koma-release-manifest.json`;

const fetchGithubRelease = async (
  channel: UpdaterChannel,
): Promise<GithubReleasePayload | null> => {
  try {
    const staticRes = await fetchWithTimeoutAndRetry(staticManifestUrlForChannel(channel));
    if (staticRes.ok) {
      return parseGithubReleaseJson(await staticRes.json(), channel);
    }
  } catch {
  }

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (channel === "stable") {
    const response = await fetchWithTimeoutAndRetry(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`GitHub API respondeu ${response.status}.`);
    }
    return parseGithubReleaseJson(await response.json(), channel);
  }

  const response = await fetchWithTimeoutAndRetry(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=20`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(`GitHub API respondeu ${response.status}.`);
  }

  return parseGithubReleaseJson(await response.json(), channel);
};

export interface UseUpdaterApi {
  status: UpdaterStatus;
  currentVersion: string | null;
  newVersion: string | null;
  mandatory: boolean;
  blocking: boolean;
  blockingReason: "mandatory-update" | null;
  releaseNotes: string | null;
  checkedAt: number | null;
  downloadedAt: number | null;
  channel: UpdaterChannel;
  provider: "github" | "generic";
  autoInstallOnQuit: boolean;
  autoInstallSupported: boolean;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  openReleasePage: () => Promise<void>;
  installUpdate: () => Promise<void>;
  rollbackUpdate: () => Promise<void>;
  postpone: () => Promise<void>;
  setChannel: (channel: UpdaterChannel) => Promise<void>;
  setAutoInstall: (enabled: boolean) => Promise<void>;
}

const UpdaterContext = createContext<UseUpdaterApi | null>(null);
const UpdaterBlockingContext = createContext<boolean>(false);
const UpdaterVersionContext = createContext<Pick<UseUpdaterApi, "currentVersion" | "channel">>(
  Object.freeze({ currentVersion: null, channel: "stable" }),
);
// Progress lives in its own context: download ticks (10-50/s) change it while
// the main api stays referentially stable, so only progress consumers render.
const UpdaterProgressContext = createContext<UpdaterProgress>(ZERO_PROGRESS);

const useProvideUpdater = (): { api: UseUpdaterApi; progress: UpdaterProgress } => {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(updaterStateReducer, null, createInitialState);
  const releasePageUrlRef = useRef<string | null>(null);
  const githubBackoffAttemptsRef = useRef(0);
  const lastCheckAttemptAtRef = useRef<number>(0);

  const patchState = useCallback((patch: Partial<UpdaterState>) => {
    dispatch(patch);
  }, []);

  const statusRef = useRef<UpdaterStatus>(state.status);

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  const { autoInstallSupported, updaterBridgeRef } = useInstallerUpdaterBridge({
    patchState,
    statusRef,
  });

  const runGithubCheck = useCallback(async (
    channelOverride?: UpdaterChannel,
    options?: { background?: boolean; reason?: "focus" | "timer" },
  ): Promise<void> => {
    const installedVersion = state.currentVersion;
    if (!installedVersion) {
      return;
    }

    const now = Date.now();
    if (
      options?.background &&
      options.reason === "focus" &&
      lastCheckAttemptAtRef.current > 0 &&
      now - lastCheckAttemptAtRef.current < FOCUS_COOLDOWN_MS
    ) {
      return;
    }

    const lifecycleActive =
      statusRef.current === "downloading" || statusRef.current === "downloaded";
    if (lifecycleActive && options?.background === true) {
      return;
    }

    lastCheckAttemptAtRef.current = now;
    const effectiveChannel = channelOverride ?? state.channel;
    const nativeCheck = updaterBridgeRef.current?.check;

    if (!lifecycleActive) {
      patchState({
        status: "checking",
        provider: "github",
        error: null,
        progress: null,
        checkedAt: now,
      });
    }

    if (nativeCheck) {
      try {
        const nextState = await nativeCheck({ channel: effectiveChannel });
        githubBackoffAttemptsRef.current = 0;
        if (nextState) {
          releasePageUrlRef.current = buildReleasePageUrl(
            effectiveChannel,
            nextState.newVersion,
          );
          if (lifecycleActive) {
            patchState({
              newVersion: nextState.newVersion,
              releaseNotes: nextState.releaseNotes,
              checkedAt: nextState.checkedAt ?? Date.now(),
            });
            return;
          }
          patchState({
            status: nextState.status,
            currentVersion: nextState.currentVersion ?? state.currentVersion,
            newVersion: nextState.newVersion,
            mandatory: nextState.mandatory,
            blocking: nextState.blocking,
            blockingReason: nextState.blockingReason,
            releaseNotes: nextState.releaseNotes,
            checkedAt: nextState.checkedAt ?? Date.now(),
            error: nextState.error,
          });
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check for updates.";
        if (!lifecycleActive) {
          patchState({
            status: "error",
            error: `Failed to check for updates: ${message}`,
          });
        }
        return;
      }
    }

    try {
      const release = await fetchGithubRelease(effectiveChannel);
      githubBackoffAttemptsRef.current = 0;

      if (!release) {
        if (lifecycleActive) {
          patchState({ checkedAt: Date.now() });
          return;
        }
        patchState({
          status: "not-available",
          newVersion: null,
          mandatory: false,
          blocking: false,
          blockingReason: null,
          releaseNotes: null,
          error: null,
          checkedAt: Date.now(),
        });
        return;
      }

      const latestVersion = normalizeVersion(release.tag_name ?? release.name ?? "");
      if (!latestVersion) {
        throw new Error("Release sem tag/version valida.");
      }

      releasePageUrlRef.current =
        typeof release.html_url === "string" && release.html_url.trim().length > 0
          ? release.html_url
          : null;

      const compareResult = compareVersions(latestVersion, installedVersion);
      const shouldOfferRelease = compareResult > 0;

      if (shouldOfferRelease) {
        if (lifecycleActive) {
          patchState({
            newVersion: latestVersion,
            releaseNotes: typeof release.body === "string" ? release.body : null,
            checkedAt: Date.now(),
          });
          return;
        }
        patchState({
          status: "available",
          newVersion: latestVersion,
          mandatory: false,
          blocking: false,
          blockingReason: null,
          releaseNotes: typeof release.body === "string" ? release.body : null,
          error: null,
          checkedAt: Date.now(),
        });
        return;
      }

      if (lifecycleActive) {
        patchState({ checkedAt: Date.now() });
        return;
      }

      patchState({
        status: "not-available",
        newVersion: null,
        mandatory: false,
        blocking: false,
        blockingReason: null,
        releaseNotes: null,
        error: null,
        checkedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check for updates.";
      const rateLimited = message.includes("403") || message.includes("429");
      githubBackoffAttemptsRef.current = rateLimited
        ? Math.min(githubBackoffAttemptsRef.current + 1, MAX_BACKOFF_ATTEMPTS)
        : 0;

      if (lifecycleActive) {
        return;
      }

      patchState({
        status: "error",
        error: `Failed to check for updates: ${message}`,
      });
    }
  }, [patchState, state.channel, state.currentVersion, updaterBridgeRef]);

  useEffect(() => {
    const storedChannel = localStorage.getItem(CHANNEL_STORAGE_KEY);
    if (hasExplicitChannelChoice() && isUpdaterChannel(storedChannel)) {
      patchState({
        channel: storedChannel,
        allowPrerelease: storedChannel === "beta",
      });
    }
    // One-shot restore; runGithubCheck closure picks up the channel on re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = (): void => {
      void runGithubCheck(undefined, { background: true, reason: "timer" }).finally(() => {
        if (cancelled) return;
        const attempts = githubBackoffAttemptsRef.current;
        const delay = Math.min(PERIODIC_CHECK_MS * 2 ** attempts, PERIODIC_CHECK_MS * 4);
        timer = setTimeout(tick, delay);
      });
    };

    timer = setTimeout(tick, CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [runGithubCheck]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const handleForegroundCheck = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void runGithubCheck(undefined, { background: true, reason: "focus" });
    };

    window.addEventListener("focus", handleForegroundCheck);
    document.addEventListener("visibilitychange", handleForegroundCheck);

    return () => {
      window.removeEventListener("focus", handleForegroundCheck);
      document.removeEventListener("visibilitychange", handleForegroundCheck);
    };
  }, [runGithubCheck]);

  const openReleasePage = useCallback(async (): Promise<void> => {
    const releaseUrl =
      releasePageUrlRef.current ??
      buildReleasePageUrl(state.channel, state.newVersion);

    try {
      if (typeof window !== "undefined" && desktopBridge.desktop?.openExternal) {
        await desktopBridge.desktop.openExternal(releaseUrl);
      } else if (typeof window !== "undefined") {
        const popup = window.open(releaseUrl, "_blank", "noopener,noreferrer");
        if (!popup) {
          throw new Error("Popup bloqueado pelo navegador.");
        }
      } else {
        throw new Error("This environment does not support opening external links.");
      }
    } catch (error) {
      patchState({
        status: "error",
        error:
          error instanceof Error
            ? `Failed to open the release page: ${error.message}`
            : "Failed to open the release page.",
      });
    }
  }, [patchState, state.channel, state.newVersion]);

  const api = useMemo<UseUpdaterApi>(() => ({
    status: state.status,
    currentVersion: state.currentVersion,
    newVersion: state.newVersion,
    mandatory: state.mandatory,
    blocking: state.blocking,
    blockingReason: state.blockingReason,
    releaseNotes: state.releaseNotes,
    checkedAt: state.checkedAt,
    downloadedAt: state.downloadedAt,
    channel: state.channel,
    provider: state.provider,
    autoInstallOnQuit: state.autoInstallOnQuit,
    autoInstallSupported,
    error: state.error,
    checkForUpdates: async () => {
      await runGithubCheck();
    },
    downloadUpdate: async () => {
      if (autoInstallSupported) {
        const bridge = updaterBridgeRef.current;
        if (!bridge) {
          patchState({
            status: "error",
            error: UPDATER_BRIDGE_UNAVAILABLE,
          });
          return;
        }
        if (statusRef.current === "downloading") {
          return;
        }
        patchState({
          status: "downloading",
          progress: ZERO_PROGRESS,
          error: null,
        });
        try {
          await bridge.download({ channel: state.channel });
        } catch (error) {
          patchState({
            status: "error",
            error: error instanceof Error
              ? `Failed to download the update: ${error.message}`
              : "Failed to download the update.",
          });
        }
        return;
      }
      await openReleasePage();
    },
    openReleasePage,
    installUpdate: async () => {
      if (autoInstallSupported) {
        const bridge = updaterBridgeRef.current;
        if (!bridge) {
          patchState({
            status: "error",
            error: UPDATER_BRIDGE_UNAVAILABLE,
          });
          return;
        }
        try {
          await bridge.install();
        } catch (error) {
          patchState({
            status: "error",
            error: installFailureMessage(error),
          });
        }
        return;
      }
      patchState({
        status: "error",
        error: "Source builds update through the sync pipeline, not installer downloads.",
      });
    },
    rollbackUpdate: async () => {
      patchState({
        status: "error",
        error: "Automatic rollback is not available in the source-sync model (use git).",
      });
    },
    postpone: async () => {
      patchState({
        status: state.blocking ? "available" : "idle",
        error: state.blocking ? t("updater.mandatoryUpdate") : null,
      });
    },
    setChannel: async (channel: UpdaterChannel) => {
      localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
      localStorage.setItem(CHANNEL_STORAGE_EXPLICIT_KEY, "true");
      patchState({
        channel,
        allowPrerelease: channel === "beta",
      });
      await runGithubCheck(channel);
    },
    setAutoInstall: async (enabled: boolean) => {
      patchState({
        autoInstallOnQuit: enabled,
      });
      try {
        const nextState = await updaterBridgeRef.current?.setAutoInstall?.({ enabled });
        if (nextState) {
          patchState({ autoInstallOnQuit: nextState.autoInstallOnQuit });
        }
      } catch {
      }
    },
  }), [
    autoInstallSupported,
    openReleasePage,
    patchState,
    runGithubCheck,
    state.autoInstallOnQuit,
    state.blocking,
    state.blockingReason,
    state.channel,
    state.checkedAt,
    state.currentVersion,
    state.downloadedAt,
    state.error,
    state.mandatory,
    state.newVersion,
    state.provider,
    state.releaseNotes,
    state.status,
    t,
    updaterBridgeRef,
  ]);

  const progress = useMemo<UpdaterProgress>(
    () => state.progress ?? ZERO_PROGRESS,
    [state.progress],
  );

  return { api, progress };
};

export const UpdaterProvider = ({ children }: { children: ReactNode }) => {
  const { api, progress } = useProvideUpdater();
  const versionValue = useMemo(
    () => ({
      currentVersion: api.currentVersion,
      channel: api.channel,
    }),
    [api.channel, api.currentVersion],
  );

  return createElement(
    UpdaterVersionContext.Provider,
    { value: versionValue },
    createElement(
      UpdaterBlockingContext.Provider,
      { value: api.blocking },
      createElement(
        UpdaterProgressContext.Provider,
        { value: progress },
        createElement(UpdaterContext.Provider, { value: api }, children),
      ),
    ),
  );
};

export const useUpdater = (): UseUpdaterApi => {
  const context = useContext(UpdaterContext);
  if (!context) {
    throw new Error("useUpdater must be used inside UpdaterProvider");
  }

  return context;
};

export const useUpdaterProgress = (): UpdaterProgress => useContext(UpdaterProgressContext);

export const useUpdaterBlocking = (): boolean => useContext(UpdaterBlockingContext);

export const useUpdaterVersionInfo = (): Pick<UseUpdaterApi, "currentVersion" | "channel"> =>
  useContext(UpdaterVersionContext);
