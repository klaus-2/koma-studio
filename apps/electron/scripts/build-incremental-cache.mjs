import fs from "node:fs";
import path from "node:path";

import {
  computeSourceHash,
  getCacheDir,
  readCachedHash,
  writeCachedHash,
} from "./build-cache.mjs";

const ELECTRON_TYPECHECK_CACHE_KEY = "typescript-electron";
const HARDENED_MINI_BACKEND_CACHE_KEY = "mini-backend-hardened";
const HARDENED_MINI_BACKEND_MARKER = ".hardened-build-meta.json";

const resolveMiniBackendExecutablePath = (rootDir, distDir = path.join(rootDir, "mini-backend", "dist")) =>
  path.join(distDir, process.platform === "win32" ? "mini-backend.exe" : "mini-backend");

export const getMiniBackendSourceHash = (rootDir) =>
  computeSourceHash([
    path.join(rootDir, "mini-backend"),
    path.join(rootDir, "scripts"),
  ]);

export const getElectronTypecheckSourceHash = (rootDir) =>
  computeSourceHash(
    [
      path.join(rootDir, "electron"),
      // shared-models now lives in packages/types (sibling workspace)
      path.join(rootDir, "..", "..", "packages", "types", "src"),
    ],
    {
      fileFilter: (filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx") || filePath.endsWith(".json"),
    },
  );

export const getElectronTypecheckCacheDir = (rootDir) => getCacheDir(rootDir, ELECTRON_TYPECHECK_CACHE_KEY);

export const hasElectronBuildOutputs = (rootDir) => {
  const distElectronDir = path.join(rootDir, "dist-electron");
  if (!fs.existsSync(distElectronDir)) {
    return false;
  }

  return fs.readdirSync(distElectronDir).some((entry) => entry.endsWith(".js"));
};

export const shouldSkipElectronTypecheck = (rootDir) => {
  if (!hasElectronBuildOutputs(rootDir)) {
    return { skip: false, reason: "missing-outputs" };
  }

  const cacheDir = getElectronTypecheckCacheDir(rootDir);
  const currentHash = getElectronTypecheckSourceHash(rootDir);
  const cachedHash = readCachedHash(cacheDir);
  return {
    skip: cachedHash === currentHash,
    reason: cachedHash === currentHash ? "cache-hit" : cachedHash ? "cache-miss" : "missing-cache",
    cacheDir,
    currentHash,
    cachedHash,
  };
};

export const writeElectronTypecheckCache = (rootDir) => {
  const cacheDir = getElectronTypecheckCacheDir(rootDir);
  const currentHash = getElectronTypecheckSourceHash(rootDir);
  writeCachedHash(cacheDir, currentHash);
  return { cacheDir, currentHash };
};

export const shouldSkipMiniBackendBuild = (rootDir) => {
  const venvName = process.env.MINI_BACKEND_VENV_NAME || ".venv-mini";
  const venvPath = path.isAbsolute(venvName) ? venvName : path.join(rootDir, venvName);
  const venvPython = process.platform === "win32"
    ? path.join(venvPath, "Scripts", "python.exe")
    : path.join(venvPath, "bin", "python");
  const distDir = process.env.MINI_BACKEND_DIST_DIR
    ? path.resolve(rootDir, process.env.MINI_BACKEND_DIST_DIR)
    : path.join(rootDir, "mini-backend", "dist");
  const executablePath = resolveMiniBackendExecutablePath(rootDir, distDir);

  if (!fs.existsSync(venvPython)) {
    return { skip: false, reason: "missing-venv" };
  }
  if (!fs.existsSync(executablePath)) {
    return { skip: false, reason: "missing-executable" };
  }

  const cacheDir = getCacheDir(rootDir, "mini-backend-profile-cpu");
  const currentHash = getMiniBackendSourceHash(rootDir);
  const cachedHash = readCachedHash(cacheDir);

  return {
    skip: cachedHash === currentHash,
    reason: cachedHash === currentHash ? "cache-hit" : cachedHash ? "cache-miss" : "missing-cache",
    cacheDir,
    currentHash,
    cachedHash,
  };
};

export const getHardenedMiniBackendCacheDir = (rootDir) =>
  getCacheDir(rootDir, HARDENED_MINI_BACKEND_CACHE_KEY);

const getHardenedMiniBackendMarkerPath = (rootDir) =>
  path.join(rootDir, "mini-backend", "dist", HARDENED_MINI_BACKEND_MARKER);

export const resolveHardenedMiniBackendHash = (rootDir, options = {}) => {
  const sourceHash = getMiniBackendSourceHash(rootDir);
  return `${sourceHash}:${JSON.stringify({
    skipCython: options.skipCython === true,
    skipPyarmor: options.skipPyarmor === true,
    platform: process.platform,
    arch: process.arch,
  })}`;
};

export const shouldSkipHardenedMiniBackendBuild = (rootDir, options = {}) => {
  const executablePath = resolveMiniBackendExecutablePath(rootDir);
  if (!fs.existsSync(executablePath)) {
    return { skip: false, reason: "missing-executable" };
  }

  const cacheDir = getHardenedMiniBackendCacheDir(rootDir);
  const currentHash = resolveHardenedMiniBackendHash(rootDir, options);
  const cachedHash = readCachedHash(cacheDir);
  const markerPath = getHardenedMiniBackendMarkerPath(rootDir);
  let markerHash = null;
  if (fs.existsSync(markerPath)) {
    try {
      const marker = JSON.parse(fs.readFileSync(markerPath, "utf-8"));
      markerHash = typeof marker?.hash === "string" ? marker.hash : null;
    } catch {
      markerHash = null;
    }
  }

  return {
    skip: cachedHash === currentHash && markerHash === currentHash,
    reason:
      cachedHash === currentHash && markerHash === currentHash
        ? "cache-hit"
        : !cachedHash
          ? "missing-cache"
          : markerHash !== currentHash
            ? "missing-marker"
            : "cache-miss",
    cacheDir,
    currentHash,
    cachedHash,
    markerPath,
    markerHash,
  };
};

export const writeHardenedMiniBackendCache = (rootDir, options = {}) => {
  const cacheDir = getHardenedMiniBackendCacheDir(rootDir);
  const currentHash = resolveHardenedMiniBackendHash(rootDir, options);
  writeCachedHash(cacheDir, currentHash);
  const markerPath = getHardenedMiniBackendMarkerPath(rootDir);
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify({
      hash: currentHash,
      skipCython: options.skipCython === true,
      skipPyarmor: options.skipPyarmor === true,
      platform: process.platform,
      arch: process.arch,
    }, null, 2)}\n`,
    "utf-8",
  );
  return { cacheDir, currentHash, markerPath };
};
