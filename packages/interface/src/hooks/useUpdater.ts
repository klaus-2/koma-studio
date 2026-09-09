import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import packageJson from "../../package.json";
import { useI18n } from "../i18n";
import { fetchWithTimeoutAndRetry } from "../utils/http";
import { buildIncrementalManifestUrl } from "@/lib/tauri/update-url";

import type {
  IUpdaterBridge,
  UpdaterChannel,
  UpdaterEventName,
  UpdaterEventPayload,
  UpdaterProgress,
  UpdaterState,
  UpdaterStatus,
} from "../types";

import { desktopBridge } from "@/lib/desktop-bridge";
const CHANNEL_STORAGE_KEY = "updater-channel";
const CHANNEL_STORAGE_VERSION_KEY = "updater-channel-version";
const CHANNEL_STORAGE_EXPLICIT_KEY = "updater-channel-explicit";
const AUTO_INSTALL_STORAGE_KEY = "updater-auto-install-on-quit";
const CHECK_DELAY_MS = 8_000;
const PERIODIC_CHECK_MS = 60 * 1_000;

type PackagePublishConfig = {
  provider?: unknown;
  owner?: unknown;
  repo?: unknown;
};

const packageVersion =
  typeof (packageJson as { version?: unknown }).version === "string"
    ? (packageJson as { version: string }).version
    : "0.0.0";
const publishConfig = Array.isArray((packageJson as { build?: { publish?: unknown } }).build?.publish)
  ? (((packageJson as { build?: { publish?: unknown[] } }).build?.publish?.[0] ?? null) as
      | PackagePublishConfig
      | null)
  : null;
const fallbackGithubOwner =
  typeof publishConfig?.owner === "string" ? publishConfig.owner : "your-username";
const fallbackGithubRepo =
  typeof publishConfig?.repo === "string" ? publishConfig.repo : "koma-studio-releases";
const fallbackProvider = publishConfig?.provider === "generic" ? "generic" : "github";

const UPDATER_EVENTS: UpdaterEventName[] = [
  "status",
  "checking",
  "available",
  "not-available",
  "progress",
  "downloaded",
  "error",
];

const inferChannelFromVersion = (version: string): UpdaterChannel =>
  version.includes("-") ? "beta" : "stable";

const ZERO_PROGRESS: UpdaterProgress = Object.freeze({
  percent: 0,
  transferred: 0,
  total: 0,
  speed: 0,
});

const initialState: UpdaterState = {
  status: "idle",
  currentVersion: packageVersion,
  newVersion: null,
  mandatory: false,
  blocking: false,
  blockingReason: null,
  releaseNotes: null,
  channel: inferChannelFromVersion(packageVersion),
  provider: fallbackProvider,
  autoInstallOnQuit: true,
  allowPrerelease: inferChannelFromVersion(packageVersion) === "beta",
  progress: null,
  checkedAt: null,
  downloadedAt: null,
  error: null,
};

type UpdaterStateAction =
  | { type: "replace"; nextState: UpdaterState }
  | { type: "patch"; nextState: Partial<UpdaterState> };

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

const updaterStateReducer = (state: UpdaterState, action: UpdaterStateAction): UpdaterState => {
  const nextState = action.type === "replace"
    ? action.nextState
    : {
        ...state,
        ...action.nextState,
      };

  return areUpdaterStatesEqual(state, nextState) ? state : nextState;
};

const isUpdaterChannel = (value: string | null): value is UpdaterChannel =>
  value === "stable" || value === "beta";

const parseStoredBoolean = (value: string | null): boolean | null => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  return null;
};

const getUpdaterBridge = (): IUpdaterBridge | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return desktopBridge.updater ?? null;
};

const resolveIncrementalManifestUrl = (channel: UpdaterChannel): string | null =>
  buildIncrementalManifestUrl(
    desktopBridge.getRuntimeConfig().runtimeArtifactsUrl ?? null,
    channel,
  );

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
  owner: string,
  repo: string,
  channel: UpdaterChannel,
): Promise<GithubReleasePayload | null> => {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (channel === "stable") {
    const response = await fetchWithTimeoutAndRetry(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`GitHub API respondeu ${response.status}.`);
    }
    return (await response.json()) as GithubReleasePayload;
  }

  const response = await fetchWithTimeoutAndRetry(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`GitHub API respondeu ${response.status}.`);
  }

  const releases = (await response.json()) as GithubReleasePayload[];
  const match = releases.find((release) => !release.draft);
  return match ?? null;
};

const buildFallbackReleaseUrl = (
  owner: string,
  repo: string,
  channel: UpdaterChannel,
  version: string | null,
): string => {
  const base = `https://github.com/${owner}/${repo}/releases`;
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
  currentVersion: string;
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
  Object.freeze({
    currentVersion: packageVersion,
    channel: inferChannelFromVersion(packageVersion),
  }),
);

const useProvideUpdater = (): UseUpdaterApi => {
  const { t } = useI18n();
  const bridge = useMemo(getUpdaterBridge, []);
  const [state, dispatch] = useReducer(updaterStateReducer, initialState);
  const fallbackReleasePageUrlRef = useRef<string | null>(null);
  const usingBridge = Boolean(bridge);

  const applyState = useCallback((nextState: UpdaterState) => {
    dispatch({ type: "replace", nextState });
  }, []);

  const patchState = useCallback((nextState: Partial<UpdaterState>) => {
    dispatch({ type: "patch", nextState });
  }, []);

  const runAction = useCallback(
    async (callback: (api: IUpdaterBridge) => Promise<UpdaterState>): Promise<void> => {
      if (!bridge) {
        return;
      }

      try {
        const nextState = await callback(bridge);
        applyState(nextState);
      } catch (error) {
        patchState({
          status: "error",
          error: error instanceof Error ? error.message : "Updater failed.",
        });
      }
    },
    [applyState, bridge, patchState],
  );

  const runGithubFallbackCheck = useCallback(async (channelOverride?: UpdaterChannel): Promise<void> => {
    const owner = fallbackGithubOwner;
    const repo = fallbackGithubRepo;
    const effectiveChannel = channelOverride ?? state.channel;
    if (!owner || !repo || owner === "your-username") {
      patchState({
        status: "error",
        provider: "github",
        error:
          "UPDATE_GITHUB_OWNER/UPDATE_GITHUB_REPO are not configured for the web/dev fallback.",
      });
      return;
    }

    patchState({
      status: "checking",
      provider: "github",
      error: null,
      progress: null,
      checkedAt: Date.now(),
    });

    try {
      const release = await fetchGithubRelease(owner, repo, effectiveChannel);
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

      fallbackReleasePageUrlRef.current =
        typeof release.html_url === "string" && release.html_url.trim().length > 0
          ? release.html_url
          : null;

      const compareResult = compareVersions(latestVersion, state.currentVersion);
      const manualChannelOverrideActive = effectiveChannel !== inferChannelFromVersion(state.currentVersion);
      const shouldOfferRelease =
        compareResult > 0 ||
        (manualChannelOverrideActive && normalizeVersion(latestVersion) !== normalizeVersion(state.currentVersion));

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
      patchState({
        status: "error",
        error:
          error instanceof Error
            ? `Failed to check for updates (GitHub fallback): ${error.message}`
            : "Failed to check for updates (GitHub fallback).",
      });
    }
  }, [patchState, state.channel, state.currentVersion]);

  const runScheduledCheck = useCallback(async (): Promise<void> => {
    if (bridge) {
      await runAction((api) => api.check(resolveIncrementalManifestUrl(state.channel) ?? undefined));
      return;
    }

    await runGithubFallbackCheck();
  }, [bridge, runAction, runGithubFallbackCheck, state.channel]);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    let mounted = true;

    const statusListener = (payload: UpdaterEventPayload): void => {
      if (!mounted) {
        return;
      }
      applyState(payload.state);
    };

    const syncInitialStatus = async (): Promise<void> => {
      try {
        const initialStatus = await bridge.getStatus();
        if (!mounted) {
          return;
        }
        applyState(initialStatus);

        const storedChannel = localStorage.getItem(CHANNEL_STORAGE_KEY);
        const storedChannelVersion = localStorage.getItem(CHANNEL_STORAGE_VERSION_KEY);
        const storedChannelExplicit = localStorage.getItem(CHANNEL_STORAGE_EXPLICIT_KEY) === "true";
        if (
          storedChannelExplicit &&
          isUpdaterChannel(storedChannel) &&
          storedChannel !== initialStatus.channel &&
          storedChannelVersion === initialStatus.currentVersion
        ) {
          const updatedState = await bridge.setChannel(storedChannel);
          if (mounted) {
            applyState(updatedState);
          }
        } else {
          localStorage.setItem(CHANNEL_STORAGE_KEY, initialStatus.channel);
          localStorage.setItem(CHANNEL_STORAGE_VERSION_KEY, initialStatus.currentVersion);
        }

        const storedAutoInstall = parseStoredBoolean(localStorage.getItem(AUTO_INSTALL_STORAGE_KEY));
        if (
          typeof storedAutoInstall === "boolean" &&
          storedAutoInstall !== initialStatus.autoInstallOnQuit
        ) {
          const updatedState = await bridge.setAutoInstall(storedAutoInstall);
          if (mounted) {
            applyState(updatedState);
          }
        }
      } catch (error) {
        if (!mounted) {
          return;
        }
        patchState({
          status: "error",
          error: error instanceof Error ? error.message : "Failed to synchronize the updater.",
        });
      }
    };

    UPDATER_EVENTS.forEach((eventName) => {
      bridge.on(eventName, statusListener);
    });
    void syncInitialStatus();

    return () => {
      mounted = false;
      UPDATER_EVENTS.forEach((eventName) => {
        bridge.off(eventName, statusListener);
      });
    };
  }, [applyState, bridge, patchState]);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    const delayedTimer = setTimeout(() => {
      void runScheduledCheck();
    }, CHECK_DELAY_MS);

    return () => {
      clearTimeout(delayedTimer);
    };
  }, [bridge, runScheduledCheck]);

  useEffect(() => {
    if (usingBridge) {
      return;
    }

    patchState({
      currentVersion: packageVersion,
      provider: fallbackProvider,
      channel: inferChannelFromVersion(packageVersion),
      allowPrerelease: inferChannelFromVersion(packageVersion) === "beta",
    });

    const delayedTimer = setTimeout(() => {
      void runGithubFallbackCheck();
    }, CHECK_DELAY_MS);
    const periodicTimer = setInterval(() => {
      void runGithubFallbackCheck();
    }, PERIODIC_CHECK_MS);

    return () => {
      clearTimeout(delayedTimer);
      clearInterval(periodicTimer);
    };
  }, [patchState, runGithubFallbackCheck, usingBridge]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const handleForegroundCheck = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void runScheduledCheck();
    };

    window.addEventListener("focus", handleForegroundCheck);
    document.addEventListener("visibilitychange", handleForegroundCheck);

    return () => {
      window.removeEventListener("focus", handleForegroundCheck);
      document.removeEventListener("visibilitychange", handleForegroundCheck);
    };
  }, [runScheduledCheck]);

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
      if (usingBridge) {
        await runAction((api) => api.check(resolveIncrementalManifestUrl(state.channel) ?? undefined));
        return;
      }
      await runGithubFallbackCheck();
    },
    downloadUpdate: async () => {
      if (usingBridge && bridge) {
        if (state.status !== "available" && state.status !== "downloading") {
          return;
        }

        try {
          const nextState = await bridge.download();
          if (nextState) {
            applyState(nextState);
          }
        } catch (error) {
          patchState({
            status: "error",
            error: error instanceof Error ? error.message : "Failed to download the update.",
          });
        }
        return;
      }

      const owner = fallbackGithubOwner;
      const repo = fallbackGithubRepo;
      const releaseUrl =
        fallbackReleasePageUrlRef.current ??
        buildFallbackReleaseUrl(owner, repo, state.channel, state.newVersion);

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
              ? `Failed to open the download page: ${error.message}`
              : "Failed to open the download page.",
        });
      }
    },
    installUpdate: async () => {
      if (usingBridge) {
        await runAction((api) => api.install());
        return;
      }
      patchState({
        status: "error",
        error: "Automatic installation is only available in the desktop app.",
      });
    },
    rollbackUpdate: async () => {
      if (usingBridge) {
        await runAction((api) => api.rollback());
        return;
      }
      patchState({
        status: "error",
        error: "Automatic rollback is only available in the desktop app.",
      });
    },
    postpone: async () => {
      if (usingBridge) {
        await runAction((api) => api.postpone());
        return;
      }
      patchState({
        status: state.blocking ? "available" : "idle",
        error: state.blocking ? t("updater.mandatoryUpdate") : null,
      });
    },
    setChannel: async (channel: UpdaterChannel) => {
      localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
      localStorage.setItem(CHANNEL_STORAGE_VERSION_KEY, state.currentVersion);
      localStorage.setItem(CHANNEL_STORAGE_EXPLICIT_KEY, "true");
      if (usingBridge) {
        await runAction((api) => api.setChannel(channel));
        await runAction((api) => api.check(resolveIncrementalManifestUrl(channel) ?? undefined));
        return;
      }
      patchState({
        channel,
        allowPrerelease: channel === "beta",
      });
      await runGithubFallbackCheck(channel);
    },
    setAutoInstall: async (enabled: boolean) => {
      localStorage.setItem(AUTO_INSTALL_STORAGE_KEY, String(enabled));
      if (usingBridge) {
        await runAction((api) => api.setAutoInstall(enabled));
        return;
      }
      patchState({
        autoInstallOnQuit: enabled,
      });
    },
  }), [
    applyState,
    bridge,
    patchState,
    runAction,
    runGithubFallbackCheck,
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
    usingBridge,
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
