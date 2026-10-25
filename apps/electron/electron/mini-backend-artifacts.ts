import type { MiniBackendAccelerationProfile } from "./mini-backend-runtime.ts";

export interface MiniBackendRuntimeArtifactProfile {
  profile: MiniBackendAccelerationProfile;
  optional?: boolean;
}

export interface MiniBackendRuntimeArtifactPart {
  file: string;
  url: string;
  sha512: string;
  size: number;
}

export interface MiniBackendRuntimeArtifactRecord {
  profile: MiniBackendAccelerationProfile;
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  entry: string;
  parts: MiniBackendRuntimeArtifactPart[];
}

export interface MiniBackendRuntimeArtifactManifest {
  schemaVersion: 2;
  version: string;
  generatedAt: string;
  platform: NodeJS.Platform;
  arch: string;
  defaultProfile: MiniBackendAccelerationProfile;
  profiles: Partial<Record<MiniBackendAccelerationProfile, MiniBackendRuntimeArtifactRecord>>;
}

export interface MiniBackendRuntimeArtifactOption {
  profile: MiniBackendAccelerationProfile;
  version: string;
  size: number;
  installed: boolean;
  recommended: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Manifest-controlled segments (`version`, `entry`, `fileName`) are joined
 * into filesystem paths: a single, relative, Win32-safe component only.
 * Trailing dots/spaces are rejected because Win32 strips them and would
 * alias a sibling directory.
 */
export const isSafeManifestPathSegment = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  return (
    value.length > 0
    && value.length <= 200
    && value.trim() === value
    && value !== "."
    && value !== ".."
    && !value.endsWith(".")
    && !value.endsWith(" ")
    // eslint-disable-next-line no-control-regex -- rejecting control characters is the check itself
    && !/[/\\:\u0000-\u001f]/.test(value)
  );
};

const isAbsoluteUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Rejects a manifest that would escape the runtime install/temp directories
 * through its own fields before any path is built from it. Part URLs must be
 * absolute (tag-pinned release URLs), never relative: relative URLs resolved
 * against a `releases/latest` manifest re-enter the moving latest slot.
 */
export const isMiniBackendRuntimeArtifactManifest = (
  payload: unknown,
): payload is MiniBackendRuntimeArtifactManifest => {
  if (!isRecord(payload)) {
    return false;
  }
  if (payload.schemaVersion !== 2) {
    return false;
  }
  if (!isSafeManifestPathSegment(payload.version)) {
    return false;
  }
  if (typeof payload.platform !== "string" || payload.platform.length === 0) {
    return false;
  }
  if (typeof payload.arch !== "string" || payload.arch.length === 0) {
    return false;
  }
  if (typeof payload.defaultProfile !== "string" || payload.defaultProfile.length === 0) {
    return false;
  }
  if (!isRecord(payload.profiles)) {
    return false;
  }
  for (const record of Object.values(payload.profiles)) {
    if (!isRecord(record)) {
      return false;
    }
    if (!isSafeManifestPathSegment(record.entry)) {
      return false;
    }
    if (!Array.isArray(record.parts) || record.parts.length === 0) {
      return false;
    }
    for (const part of record.parts) {
      if (!isRecord(part)) {
        return false;
      }
      if (
        !isSafeManifestPathSegment(part.file)
        || !isAbsoluteUrl(part.url)
        || typeof part.sha512 !== "string"
        || part.sha512.length === 0
        || typeof part.size !== "number"
        || !Number.isFinite(part.size)
        || part.size <= 0
      ) {
        return false;
      }
    }
  }
  return true;
};

export const sanitizeMiniBackendProfile = (profile: MiniBackendAccelerationProfile): string =>
  profile.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

export const getMiniBackendArtifactProfiles = (
  platform: NodeJS.Platform,
  {
    includeTensorRt = false,
  }: {
    includeTensorRt?: boolean;
  } = {},
): MiniBackendRuntimeArtifactProfile[] => {
  switch (platform) {
    case "win32":
      return [
        { profile: "cpu" },
        { profile: "nvidia-cuda" },
        { profile: "nvidia-cuda-legacy" },
        { profile: "intel-openvino" },
        ...(includeTensorRt ? [{ profile: "nvidia-tensorrt", optional: true } satisfies MiniBackendRuntimeArtifactProfile] : []),
      ];
    case "linux":
      return [
        { profile: "cpu" },
        { profile: "nvidia-cuda" },
        { profile: "amd-rocm" },
        { profile: "intel-openvino" },
        ...(includeTensorRt ? [{ profile: "nvidia-tensorrt", optional: true } satisfies MiniBackendRuntimeArtifactProfile] : []),
      ];
    case "darwin":
      return [
        { profile: "cpu" },
        { profile: "apple-mps" },
      ];
    default:
      return [{ profile: "cpu" }];
  }
};

export const buildMiniBackendRuntimeArtifactManifest = ({
  version,
  platform,
  arch,
  profiles,
}: {
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  profiles: MiniBackendRuntimeArtifactManifest["profiles"];
}): MiniBackendRuntimeArtifactManifest => ({
  schemaVersion: 2,
  version,
  generatedAt: new Date().toISOString(),
  platform,
  arch,
  defaultProfile: "cpu",
  profiles,
});

const sumMiniBackendRuntimeArtifactRecordBytes = (
  record: MiniBackendRuntimeArtifactRecord,
): number => record.parts.reduce((total, part) => total + part.size, 0);

export const listMiniBackendRuntimeArtifactOptions = ({
  manifest,
  recommendedProfile,
  installedProfiles = [],
}: {
  manifest: MiniBackendRuntimeArtifactManifest;
  recommendedProfile?: MiniBackendAccelerationProfile | null;
  installedProfiles?: Iterable<MiniBackendAccelerationProfile>;
}): MiniBackendRuntimeArtifactOption[] => {
  const installedProfileSet = new Set(installedProfiles);
  const preferredOrder = getMiniBackendArtifactProfiles(manifest.platform, {
    includeTensorRt: Boolean(manifest.profiles["nvidia-tensorrt"]),
  }).map((entry) => entry.profile);
  const orderIndex = new Map(
    preferredOrder.map((profile, index) => [profile, index]),
  );

  return Object.values(manifest.profiles)
    .filter((entry): entry is MiniBackendRuntimeArtifactRecord => Boolean(entry))
    .sort((left, right) => {
      const leftIndex = orderIndex.get(left.profile) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderIndex.get(right.profile) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return left.profile.localeCompare(right.profile);
    })
    .map((entry) => ({
      profile: entry.profile,
      version: entry.version,
      size: sumMiniBackendRuntimeArtifactRecordBytes(entry),
      installed: installedProfileSet.has(entry.profile),
      recommended: entry.profile === recommendedProfile,
    }));
};

export { sumMiniBackendRuntimeArtifactRecordBytes };
