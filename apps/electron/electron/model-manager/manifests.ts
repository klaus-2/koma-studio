import fs from "node:fs";
import path from "node:path";

import { MANIFEST_FILE_NAME } from "./constants.ts";
import type { DesktopDownloadModelPayload, DesktopModelManifest } from "./types.ts";
import { sanitizeModelId } from "./validation.ts";

const getModelsRootDir = (userDataDir: string): string => {
  const rootDir = path.join(userDataDir, "models");
  fs.mkdirSync(rootDir, { recursive: true });
  return rootDir;
};

const getModelDir = (userDataDir: string, modelId: string): string =>
  path.join(getModelsRootDir(userDataDir), sanitizeModelId(modelId));

const getModelManifestPath = (userDataDir: string, modelId: string): string =>
  path.join(getModelDir(userDataDir, modelId), MANIFEST_FILE_NAME);

const computeDirectorySize = (targetPath: string): number => {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return stat.size;
  }

  if (!stat.isDirectory()) {
    return 0;
  }

  let total = 0;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    total += computeDirectorySize(path.join(targetPath, entry.name));
  }

  return total;
};

const readJsonFile = <T>(filePath: string): T | null => {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJsonFile = (filePath: string, payload: unknown): void => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
};

const readInstalledManifest = (
  userDataDir: string,
  modelId: string,
): DesktopModelManifest | null => {
  try {
    const raw = fs.readFileSync(getModelManifestPath(userDataDir, modelId), "utf8");
    const parsed = JSON.parse(raw) as DesktopModelManifest;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const writeIncompleteManifest = (
  userDataDir: string,
  model: DesktopDownloadModelPayload,
  skip: boolean,
  origin = "download",
): void => {
  // An uninstall during the download removed the directory on purpose;
  // recreating it with an "incomplete" manifest resurrected a broken model.
  if (skip) {
    return;
  }

  const manifestPath = getModelManifestPath(userDataDir, model.id);
  // Never brand a working install as incomplete: a failed UPDATE of an
  // installed model used to downgrade it forever. Tauri already keeps the
  // previous manifest; the shells must agree.
  const existing = readInstalledManifest(userDataDir, model.id);
  if (existing?.status === "installed") {
    return;
  }

  const modelDir = getModelDir(userDataDir, model.id);
  fs.mkdirSync(modelDir, { recursive: true });

  const payload: DesktopModelManifest = {
    modelId: model.id,
    version: model.version,
    installedAt: new Date().toISOString(),
    checksumSHA256: model.checksumSHA256,
    status: "incomplete",
    origin,
  };

  writeJsonFile(manifestPath, payload);
};

const writeInstalledManifest = (
  userDataDir: string,
  model: DesktopDownloadModelPayload,
  origin = "download",
): void => {
  const payload: DesktopModelManifest = {
    modelId: model.id,
    version: model.version,
    installedAt: new Date().toISOString(),
    // The registry's declared digest, copied verbatim. A locally computed
    // tree hash can never equal the remote single-file digest, so the
    // update check flagged every installed model as outdated forever.
    checksumSHA256: model.checksumSHA256 ?? "",
    status: "installed",
    origin,
  };

  writeJsonFile(getModelManifestPath(userDataDir, model.id), payload);
};

export {
  computeDirectorySize,
  getModelDir,
  getModelManifestPath,
  getModelsRootDir,
  readInstalledManifest,
  readJsonFile,
  writeIncompleteManifest,
  writeInstalledManifest,
};
