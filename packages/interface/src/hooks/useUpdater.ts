import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { getDesktopAppVersion } from "../config/desktopClient";
import { useI18n } from "../i18n";
import { fetchWithTimeoutAndRetry } from "../utils/http";

import { desktopBridge } from "@/lib/desktop-bridge";

import type {
  UpdaterChannel,
  UpdaterProgress,
  UpdaterState,
  UpdaterStatus,
} from "../types";

const GITHUB_OWNER = "klaus-2";
const GITHUB_REPO = "koma-studio";

const CHANNEL_STORAGE_KEY = "updater-channel";
const CHANNEL_STORAGE_EXPLICIT_KEY = "updater-channel-explicit";
const CHECK_DELAY_MS = 8_000;
const PERIODIC_CHECK_MS = 60 * 1_000;
// api.github.com allows 60 req/h per IP unauthenticated — back off before retrying.
const MAX_BACKOFF_ATTEMPTS = 4;

const ZERO_PROGRESS: UpdaterProgress = Object.freeze({
  percent: 0,
  transferred: 0,
  total: 0,
  speed: 0,
});

const DEFAULT_UPDATER_CHANNEL: UpdaterChannel = "stable";

const inferBuildChannel = (version: string | null): UpdaterChannel =>
  version !== null && version.includes("-") ? "beta" : "stable";

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

const normalizeVersion = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return value.trim().replace(/^v/i, "");
};

const compareVersions = (a: string, b: string): number => {
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

  return (left.prerelease ?? "").localeCompare(right.prerelease ?? "");
};

const fetchGithubRelease = async (
  channel: UpdaterChannel,
): Promise<GithubReleasePayload | null> => {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (channel === "stable") {
    const response = await fetchWithTimeoutAndRetry(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`GitHub API respondeu ${response.status}.`);
    }
    return (await response.json()) as GithubReleasePayload;
  }

  const response = await fetchWithTimeoutAndRetry(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=20`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`GitHub API respondeu ${response.status}.`);
  }

  const releases = (await response.json()) as GithubReleasePayload[];
  const match = releases.find((release) => !release.draft);
  return match ?? null;
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

export interface UseUpdaterApi {
  status: UpdaterStatus;
  currentVersion: string | null;
  newVersion: string | null;
  mandatory: boolean;
  blocking: boolean;
  blockingReason: "mandatory-update" | null;
  progress: UpdaterProgress;
  releaseNotes: string | null;
  checkedAt: number | null;
  downloadedAt: number | null;
  channel: UpdaterChannel;
  provider: "github" | "generic";
  autoInstallOnQuit: boolean;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
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

const useProvideUpdater = (): UseUpdaterApi => {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(updaterStateReducer, null, createInitialState);
  const releasePageUrlRef = useRef<string | null>(null);
  const githubBackoffAttemptsRef = useRef(0);

  const patchState = useCallback((patch: Partial<UpdaterState>) => {
    dispatch(patch);
  }, []);

  const runGithubCheck = useCallback(async (channelOverride?: UpdaterChannel): Promise<void> => {
    const installedVersion = state.currentVersion;
    if (!installedVersion) {
      return;
    }

    const effectiveChannel = channelOverride ?? state.channel;

    patchState({
      status: "checking",
      provider: "github",
      error: null,
      progress: null,
      checkedAt: Date.now(),
    });

    try {
      const release = await fetchGithubRelease(effectiveChannel);
      githubBackoffAttemptsRef.current = 0;

      if (!release) {
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
      const manualChannelOverrideActive =
        hasExplicitChannelChoice() && effectiveChannel !== inferBuildChannel(installedVersion);
      const shouldOfferRelease =
        compareResult > 0 ||
        (manualChannelOverrideActive && normalizeVersion(latestVersion) !== normalizeVersion(installedVersion));

      if (shouldOfferRelease) {
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

      patchState({
        status: "error",
        error: `Failed to check for updates: ${message}`,
      });
    }
  }, [patchState, state.channel, state.currentVersion]);

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
      void runGithubCheck().finally(() => {
        if (cancelled) return;
        const attempts = githubBackoffAttemptsRef.current;
        const delay = Math.min(PERIODIC_CHECK_MS * 2 ** attempts, PERIODIC_CHECK_MS * 8);
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

      void runGithubCheck();
    };

    window.addEventListener("focus", handleForegroundCheck);
    document.addEventListener("visibilitychange", handleForegroundCheck);

    return () => {
      window.removeEventListener("focus", handleForegroundCheck);
      document.removeEventListener("visibilitychange", handleForegroundCheck);
    };
  }, [runGithubCheck]);

  const api = useMemo<UseUpdaterApi>(() => ({
    status: state.status,
    currentVersion: state.currentVersion,
    newVersion: state.newVersion,
    mandatory: state.mandatory,
    blocking: state.blocking,
    blockingReason: state.blockingReason,
    progress: state.progress ?? ZERO_PROGRESS,
    releaseNotes: state.releaseNotes,
    checkedAt: state.checkedAt,
    downloadedAt: state.downloadedAt,
    channel: state.channel,
    provider: state.provider,
    autoInstallOnQuit: state.autoInstallOnQuit,
    error: state.error,
    checkForUpdates: async () => {
      await runGithubCheck();
    },
    downloadUpdate: async () => {
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
    },
    installUpdate: async () => {
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
    },
  }), [
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
    state.progress,
    state.provider,
    state.releaseNotes,
    state.status,
    t,
  ]);

  return api;
};

export const UpdaterProvider = ({ children }: { children: ReactNode }) => {
  const updater = useProvideUpdater();
  const versionValue = useMemo(
    () => ({
      currentVersion: updater.currentVersion,
      channel: updater.channel,
    }),
    [updater.channel, updater.currentVersion],
  );

  return createElement(
    UpdaterVersionContext.Provider,
    { value: versionValue },
    createElement(
      UpdaterBlockingContext.Provider,
      { value: updater.blocking },
      createElement(UpdaterContext.Provider, { value: updater }, children),
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

export const useUpdaterBlocking = (): boolean => useContext(UpdaterBlockingContext);

export const useUpdaterVersionInfo = (): Pick<UseUpdaterApi, "currentVersion" | "channel"> =>
  useContext(UpdaterVersionContext);
