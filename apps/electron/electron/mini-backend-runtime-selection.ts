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

export const resolveSelectedRuntimeBinaryPath = (userDataDir: string): string | null => {
  const selection = readMiniBackendRuntimeSelection(userDataDir);
  if (!selection) {
    return null;
  }

  const binaryPath = path.join(
    userDataDir,
    "mini-backend-runtimes",
    selection.version,
    selection.profile,
    selection.entry,
  );

  return fs.existsSync(binaryPath) ? binaryPath : null;
};
