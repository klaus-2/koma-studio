import fs from "node:fs";
import path from "node:path";

import {
  clearMiniBackendRuntimeSelection,
  getMiniBackendRuntimeSelectionPath,
} from "../mini-backend-runtime-selection.ts";
import {
  clearMiniBackendThreadOverride,
  getMiniBackendThreadOverridePath,
} from "./mini-backend-thread-override.ts";

/**
 * File side of the local settings reset, pure in `userDataPath` so it is
 * drivable without Electron (mirrors the Tauri `reset_local_settings_at`).
 * Every known entry is reported in `clearedPaths` whether or not it existed.
 */
export const resetLocalSettingsFilesAt = (userDataPath: string): string[] => {
  const clearedPaths: string[] = [];

  const removePath = (targetPath: string, _recursive: boolean = false): void => {
    fs.rmSync(targetPath, { force: true, recursive: true });
    clearedPaths.push(targetPath);
  };

  removePath(path.join(userDataPath, "secure-store"), true);
  removePath(path.join(userDataPath, "desktop-device-id.json"));
  clearMiniBackendRuntimeSelection(userDataPath);
  clearedPaths.push(getMiniBackendRuntimeSelectionPath(userDataPath));
  clearMiniBackendThreadOverride(userDataPath);
  clearedPaths.push(getMiniBackendThreadOverridePath(userDataPath));

  return clearedPaths;
};
