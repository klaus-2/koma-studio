import path from "node:path";

import type { MiniBackendAccelerationProfile } from "./mini-backend-runtime.ts";
import { sanitizeMiniBackendProfile } from "./mini-backend-artifacts.ts";

const windowsExternalStorageRoot = (): string => process.env.KOMA_EXTERNAL_STORAGE_ROOT ?? "";

export const buildDevPythonRuntimePathCandidates = (
  profile: MiniBackendAccelerationProfile,
  cwd: string,
  platform: NodeJS.Platform,
): string[] => {
  const profileKey = sanitizeMiniBackendProfile(profile);

  if (platform === "win32") {
    const candidates = [
      path.join(cwd, `.venv-mini-${profileKey}`, "Scripts", "python.exe"),
      path.join(cwd, ".venv-mini", "Scripts", "python.exe"),
    ];
    const externalRoot = windowsExternalStorageRoot();
    if (externalRoot) {
      candidates.unshift(
        path.join(externalRoot, `.venv-mini-${profileKey}`, "Scripts", "python.exe"),
      );
    }
    return candidates;
  }

  return [
    path.join(cwd, `.venv-mini-${profileKey}`, "bin", "python"),
    path.join(cwd, ".venv-mini", "bin", "python"),
  ];
};
