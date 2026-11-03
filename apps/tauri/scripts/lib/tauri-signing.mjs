import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const updaterSigningKeyPath = () =>
  path.join(os.homedir(), ".tauri", "koma-studio-updater.key");

export const hasExportedSigningKey = (env = process.env) =>
  Object.keys(env).some((key) => key.startsWith("TAURI_SIGNING"));

export const resolveLocalSigningKeyPath = () => {
  const keyPath = updaterSigningKeyPath();
  return fs.existsSync(keyPath) ? keyPath : null;
};
