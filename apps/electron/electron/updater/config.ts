import type { UpdateChannel, UpdateProvider } from "./types";

export interface UpdaterRuntimeConfig {
  provider: UpdateProvider;
  githubOwner: string;
  githubRepo: string;
  genericServerUrl: string | null;
  autoDownload: boolean;
  autoInstallOnQuit: boolean;
  allowPrerelease: boolean;
  initialChannel: UpdateChannel;
  initialEnabled: boolean;
}

const isPrereleaseVersion = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }

  return value.trim().includes("-");
};

const toBoolean = (value: string | null, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return fallback;
};

const toChannel = (value: string | null): UpdateChannel => {
  if (value?.trim().toLowerCase() === "beta") {
    return "beta";
  }

  return "stable";
};

const resolveInitialChannel = (
  configuredChannel: string | null,
  currentVersion: string | null | undefined,
): UpdateChannel => {
  if (configuredChannel?.trim()) {
    return toChannel(configuredChannel);
  }

  return isPrereleaseVersion(currentVersion) ? "beta" : "stable";
};

const normalizeProvider = (
  value: string | null,
  genericServerUrl: string | null,
): UpdateProvider => {
  if (genericServerUrl) {
    return "generic";
  }

  if (value?.trim().toLowerCase() === "generic") {
    return "generic";
  }

  return "github";
};

const normalizeServerUrl = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const resolveGenericServerUrlForChannel = (
  serverUrl: string,
  channel: UpdateChannel,
): string => {
  const targetSegment = channel === "beta" ? "beta" : "stable";

  try {
    const parsed = new URL(serverUrl);
    let normalizedPath = parsed.pathname.endsWith("/")
      ? parsed.pathname
      : `${parsed.pathname}/`;

    if (/\/(stable|beta)\/$/i.test(normalizedPath)) {
      normalizedPath = normalizedPath.replace(/\/(stable|beta)\/$/i, `/${targetSegment}/`);
    } else {
      normalizedPath = `${normalizedPath}${targetSegment}/`;
    }

    parsed.pathname = normalizedPath;
    return parsed.toString();
  } catch {
    if (/\/(stable|beta)\/$/i.test(serverUrl)) {
      return serverUrl.replace(/\/(stable|beta)\/$/i, `/${targetSegment}/`);
    }
    const base = serverUrl.endsWith("/") ? serverUrl : `${serverUrl}/`;
    return `${base}${targetSegment}/`;
  }
};

export const createUpdaterRuntimeConfig = (
  resolveEnv: (key: string) => string | null,
  currentVersion?: string | null,
): UpdaterRuntimeConfig => {
  const genericServerUrl = normalizeServerUrl(resolveEnv("UPDATE_SERVER_URL"));
  const provider = normalizeProvider(resolveEnv("UPDATE_PROVIDER"), genericServerUrl);
  const initialEnabled = provider === "github" || Boolean(genericServerUrl);

  return {
    provider,
    githubOwner: resolveEnv("UPDATE_GITHUB_OWNER") ?? "your-username",
    githubRepo: resolveEnv("UPDATE_GITHUB_REPO") ?? "koma-studio-releases",
    genericServerUrl,
    autoDownload: toBoolean(resolveEnv("UPDATE_AUTO_DOWNLOAD"), false),
    autoInstallOnQuit: toBoolean(resolveEnv("UPDATE_AUTO_INSTALL_ON_QUIT"), true),
    allowPrerelease: toBoolean(resolveEnv("UPDATE_ALLOW_PRERELEASE"), false),
    initialChannel: resolveInitialChannel(resolveEnv("UPDATE_CHANNEL"), currentVersion),
    initialEnabled,
  };
};

export const isPrereleaseAllowed = (
  config: UpdaterRuntimeConfig,
  channel: UpdateChannel,
): boolean => config.allowPrerelease || channel === "beta";

export const getGenericProviderChannel = (channel: UpdateChannel): string =>
  channel === "beta" ? "beta" : "latest";

export const toFeedOptions = (
  config: UpdaterRuntimeConfig,
  channel: UpdateChannel,
): Record<string, unknown> | null => {
  if (config.provider === "generic") {
    if (!config.genericServerUrl) {
      return null;
    }

    return {
      provider: "generic",
      url: resolveGenericServerUrlForChannel(config.genericServerUrl, channel),
      channel: getGenericProviderChannel(channel),
      useMultipleRangeRequest: false,
    };
  }

  return {
    provider: "github",
    owner: config.githubOwner,
    repo: config.githubRepo,
    private: false,
    releaseType: channel === "beta" ? "prerelease" : "release",
  };
};
