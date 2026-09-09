import type { InstalledModelRecord, TranslationModel } from "./types";

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  preRelease: string | null;
}

const parseVersion = (value: string): ParsedVersion => {
  const trimmed = value.trim();
  const [corePart, preReleasePart] = trimmed.split("-", 2);
  const [majorRaw, minorRaw, patchRaw] = (corePart ?? '').split(".");

  const major = Number.parseInt(majorRaw ?? "0", 10);
  const minor = Number.parseInt(minorRaw ?? "0", 10);
  const patch = Number.parseInt(patchRaw ?? "0", 10);

  return {
    major: Number.isFinite(major) ? major : 0,
    minor: Number.isFinite(minor) ? minor : 0,
    patch: Number.isFinite(patch) ? patch : 0,
    preRelease: preReleasePart?.trim() || null,
  };
};

export const compareModelVersions = (leftVersion: string, rightVersion: string): number => {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  if (left.major !== right.major) return left.major > right.major ? 1 : -1;
  if (left.minor !== right.minor) return left.minor > right.minor ? 1 : -1;
  if (left.patch !== right.patch) return left.patch > right.patch ? 1 : -1;

  if (!left.preRelease && !right.preRelease) return 0;
  if (!left.preRelease) return 1;
  if (!right.preRelease) return -1;

  if (left.preRelease === right.preRelease) return 0;
  return left.preRelease > right.preRelease ? 1 : -1;
};

export const isRegistryVersionNewer = (installedVersion: string, registryVersion: string): boolean =>
  compareModelVersions(registryVersion, installedVersion) > 0;

export interface ModelVersionCheckResult {
  modelId: string;
  installedVersion: string | null;
  registryVersion: string;
  updateAvailable: boolean;
}

export const checkModelVersions = (
  installedModels: InstalledModelRecord[],
  registryModels: TranslationModel[],
): ModelVersionCheckResult[] => {
  const installedById = new Map(installedModels.map((item) => [item.modelId, item]));

  return registryModels.map((model) => {
    const installed = installedById.get(model.id);
    const installedVersion = installed?.version ?? null;
    const updateAvailable =
      installed?.status === "installed" && installedVersion
        ? isRegistryVersionNewer(installedVersion, model.version)
        : false;

    return {
      modelId: model.id,
      installedVersion,
      registryVersion: model.version,
      updateAvailable,
    };
  });
};
