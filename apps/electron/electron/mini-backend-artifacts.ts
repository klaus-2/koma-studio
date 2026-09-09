import type { MiniBackendAccelerationProfile } from "./mini-backend-runtime.ts";

export interface MiniBackendRuntimeArtifactProfile {
  profile: MiniBackendAccelerationProfile;
  optional?: boolean;
}

export interface MiniBackendRuntimeArtifactRecord {
  profile: MiniBackendAccelerationProfile;
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  fileName: string;
  url: string;
  sha512: string;
  size: number;
  entry: string;
}

export interface MiniBackendRuntimeArtifactManifest {
  schemaVersion: 1;
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
  schemaVersion: 1,
  version,
  generatedAt: new Date().toISOString(),
  platform,
  arch,
  defaultProfile: "cpu",
  profiles,
});

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
      size: entry.size,
      installed: installedProfileSet.has(entry.profile),
      recommended: entry.profile === recommendedProfile,
    }));
};
