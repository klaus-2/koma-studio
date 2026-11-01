import fs from "node:fs";
import path from "node:path";

import type { MiniBackendAccelerationProfile } from "./mini-backend-runtime.ts";

export interface MiniBackendRuntimeSelection {
  profile: MiniBackendAccelerationProfile;
  version: string;
  entry: string;
}

export const resolveRequestedRuntimeProfile = ({
  envOverrideProfile,
  selectedProfile,
  ignoreManualSelection = false,
}: {
  envOverrideProfile: MiniBackendAccelerationProfile | "auto";
  selectedProfile?: MiniBackendAccelerationProfile | null;
  ignoreManualSelection?: boolean;
}): MiniBackendAccelerationProfile | "auto" => {
  if (envOverrideProfile !== "auto") {
    return envOverrideProfile;
  }

  if (!ignoreManualSelection && selectedProfile) {
    return selectedProfile;
  }

  return "auto";
};

const RUNTIME_SELECTION_FILE_NAME = "mini-backend-runtime-selection.json";

export const getMiniBackendRuntimeSelectionPath = (userDataDir: string): string =>
  path.join(userDataDir, RUNTIME_SELECTION_FILE_NAME);

export const readMiniBackendRuntimeSelection = (
  userDataDir: string,
): MiniBackendRuntimeSelection | null => {
  try {
    const filePath = getMiniBackendRuntimeSelectionPath(userDataDir);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    if (
      typeof parsed.profile !== "string"
      || typeof parsed.version !== "string"
      || typeof parsed.entry !== "string"
    ) {
      return null;
    }

    return {
      profile: parsed.profile as MiniBackendAccelerationProfile,
      version: parsed.version,
      entry: parsed.entry,
    };
  } catch {
    return null;
  }
};

export const writeMiniBackendRuntimeSelection = (
  userDataDir: string,
  selection: MiniBackendRuntimeSelection,
): void => {
  const filePath = getMiniBackendRuntimeSelectionPath(userDataDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(selection, null, 2)}\n`, "utf8");
};

export const clearMiniBackendRuntimeSelection = (userDataDir: string): void => {
  fs.rmSync(getMiniBackendRuntimeSelectionPath(userDataDir), { force: true });
};

/**
 * The runtime ships its own launch manifest: it is the contract the shell
 * spawns against, and the first entry of the payload. A tree without it is a
 * partial extraction (an interrupted install, a half-copied directory), and
 * spawning it boots a backend that dies on its first import.
 */
const runtimeLaunchManifestDeclaresProfile = (
  installDir: string,
  profile: string,
): boolean => {
  try {
    const raw = fs.readFileSync(path.join(installDir, "launch-manifest.json"), "utf-8");
    const parsed = JSON.parse(raw) as { profiles?: Record<string, unknown> };
    return typeof parsed.profiles === "object"
      && parsed.profiles !== null
      && Object.prototype.hasOwnProperty.call(parsed.profiles, profile);
  } catch {
    return false;
  }
};

export const resolveSelectedRuntimeBinaryPath = (userDataDir: string): string | null => {
  const selection = readMiniBackendRuntimeSelection(userDataDir);
  if (!selection) {
    return null;
  }

  const installDir = path.join(
    userDataDir,
    "mini-backend-runtimes",
    selection.version,
    selection.profile,
  );
  const binaryPath = path.join(installDir, selection.entry);

  if (!fs.existsSync(binaryPath)) {
    return null;
  }
  if (!runtimeLaunchManifestDeclaresProfile(installDir, selection.profile)) {
    return null;
  }
  return binaryPath;
};
