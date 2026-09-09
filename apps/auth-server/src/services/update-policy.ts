const DEFAULT_MANIFEST_TIMEOUT_MS = 5_000;

export type DesktopUpdateChannel = "stable" | "beta";

export interface DesktopUpdateRequirement {
  version: string;
  mandatory: boolean;
  channel: DesktopUpdateChannel;
  manifestUrl: string;
}

interface CacheEntry {
  expiresAtMs: number;
  requirement: DesktopUpdateRequirement | null;
}

const manifestCache = new Map<string, CacheEntry>();

const normalizeServerUrl = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const normalizeChannel = (value: string | null | undefined): DesktopUpdateChannel => {
  return value?.trim().toLowerCase() === "beta" ? "beta" : "stable";
};

const buildManifestUrl = (serverUrl: string, channel: DesktopUpdateChannel): string => {
  const targetSegment = channel === "beta" ? "beta" : "stable";
  const fileName = channel === "beta" ? "beta.yml" : "latest.yml";

  try {
    const parsed = new URL(serverUrl);
    const normalizedPath = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
    parsed.pathname = normalizedPath.replace(/\/(stable|beta)\/?$/i, `/${targetSegment}/`);
    if (!parsed.pathname.endsWith(`/${targetSegment}/`)) {
      parsed.pathname = `${parsed.pathname}${targetSegment}/`;
    }
    return new URL(fileName, parsed.toString()).toString();
  } catch {
    const normalizedBase = serverUrl.replace(/\/(stable|beta)\/?$/i, `/${targetSegment}/`);
    const withSegment = normalizedBase.endsWith(`/${targetSegment}/`)
      ? normalizedBase
      : `${normalizedBase}${targetSegment}/`;
    return `${withSegment}${fileName}`;
  }
};

const parseManifestField = (rawManifest: string, fieldName: string): string | null => {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = rawManifest.match(new RegExp(`^${escaped}:\\s*(.+?)\\s*$`, "im"));
  if (!match) {
    return null;
  }

  const rawValue = match[1]?.trim() ?? "";
  return rawValue.replace(/^['"]|['"]$/g, "").trim() || null;
};

const parseManifestRequirement = (
  rawManifest: string,
  channel: DesktopUpdateChannel,
  manifestUrl: string,
): DesktopUpdateRequirement | null => {
  const version = parseManifestField(rawManifest, "version");
  if (!version) {
    return null;
  }

  const mandatoryRaw = parseManifestField(rawManifest, "mandatory");
  const mandatory = mandatoryRaw?.toLowerCase() === "true";

  return {
    version,
    mandatory,
    channel,
    manifestUrl,
  };
};

const parseVersion = (version: string): { numbers: number[]; prerelease: string | null } => {
  const normalized = version.trim().replace(/^v/i, "");
  const [basePart, prereleaseRaw] = normalized.split("-", 2);
  const base = basePart ?? "0.0.0";
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

export const compareDesktopVersions = (leftVersion: string, rightVersion: string): number => {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

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

  return (left.prerelease ?? "").localeCompare(right.prerelease ?? "");
};

export const resolveMandatoryUpdateRequirement = async (options: {
  updateServerUrl?: string;
  channel?: string | null;
  cacheTtlMs: number;
}): Promise<DesktopUpdateRequirement | null> => {
  const normalizedServerUrl = normalizeServerUrl(options.updateServerUrl);
  if (!normalizedServerUrl) {
    return null;
  }

  const channel = normalizeChannel(options.channel);
  const manifestUrl = buildManifestUrl(normalizedServerUrl, channel);
  const cacheKey = `${channel}:${manifestUrl}`;
  const nowMs = Date.now();
  const cached = manifestCache.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.requirement;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_MANIFEST_TIMEOUT_MS);

  try {
    const response = await fetch(manifestUrl, {
      method: "GET",
      headers: { Accept: "text/yaml,text/plain,*/*" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const nextValue = response.status === 404 ? null : null;
      manifestCache.set(cacheKey, {
        expiresAtMs: nowMs + options.cacheTtlMs,
        requirement: nextValue,
      });
      return nextValue;
    }

    const rawManifest = await response.text();
    const requirement = parseManifestRequirement(rawManifest, channel, manifestUrl);
    manifestCache.set(cacheKey, {
      expiresAtMs: nowMs + options.cacheTtlMs,
      requirement,
    });
    return requirement;
  } finally {
    clearTimeout(timeout);
  }
};

export const isMandatoryUpdatePending = async (options: {
  updateServerUrl?: string;
  channel?: string | null;
  appVersion?: string | null;
  cacheTtlMs: number;
}): Promise<DesktopUpdateRequirement | null> => {
  const appVersion = options.appVersion?.trim();
  if (!appVersion) {
    return null;
  }

  const requirement = await resolveMandatoryUpdateRequirement(options);
  if (!requirement?.mandatory) {
    return null;
  }

  return compareDesktopVersions(requirement.version, appVersion) > 0 ? requirement : null;
};
