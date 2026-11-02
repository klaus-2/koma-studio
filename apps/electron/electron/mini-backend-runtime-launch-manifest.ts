import fs from "node:fs";
import path from "node:path";

/**
 * The runtime ships its own launch manifest: it is the contract the shell
 * spawns against, and the first entry of the payload. A tree without it is a
 * partial extraction (an interrupted install, a half-copied directory), and
 * spawning it boots a backend that dies on its first import.
 *
 * The install is atomic (the parts extract into a staging dir that is
 * renamed into place), so a launch manifest in the tree means the whole
 * payload landed with it.
 */

interface RuntimeLaunchManifest {
  defaultProfile?: string;
  profiles?: Record<string, unknown>;
  requiredFiles?: string[];
}

const readRuntimeLaunchManifest = (installDir: string): RuntimeLaunchManifest | null => {
  try {
    const raw = fs.readFileSync(path.join(installDir, "launch-manifest.json"), "utf-8");
    const parsed = JSON.parse(raw) as RuntimeLaunchManifest;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Find a bundled file by its path suffix: the layout differs per platform
 * (`_internal/` on Windows and Linux, a bundle folder on macOS).
 */
const findBundledFile = (root: string, suffix: string): string | null => {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) {
      break;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (full.split(path.sep).join("/").endsWith(suffix)) {
        return full;
      }
    }
  }
  return null;
};

export const runtimeLaunchManifestDeclaresProfile = (
  installDir: string,
  profile: string,
): boolean => {
  const manifest = readRuntimeLaunchManifest(installDir);
  if (!manifest) {
    return false;
  }
  // The manifest lists every profile the build knows, so the map proves
  // nothing: the profile that was BUILT is the default one.
  if (typeof manifest.defaultProfile === "string") {
    return manifest.defaultProfile === profile;
  }
  return typeof manifest.profiles === "object"
    && manifest.profiles !== null
    && Object.prototype.hasOwnProperty.call(manifest.profiles, profile);
};

/**
 * The data files the build declared the runtime needs. A loader that reads
 * one at import takes the whole backend down when it is missing, so the
 * runtime is not spawnable without them.
 */
export const runtimeLaunchManifestDataFilesPresent = (installDir: string): boolean => {
  const manifest = readRuntimeLaunchManifest(installDir);
  const required = manifest?.requiredFiles;
  if (!Array.isArray(required)) {
    // A runtime built before the contract existed: nothing to check.
    return true;
  }
  return required.every((suffix) => typeof suffix === "string"
    && findBundledFile(installDir, suffix) !== null);
};

/**
 * The runtime binary to spawn, or null when the tree is not a complete
 * runtime for this profile. Mirrors `resolve_spawnable_runtime_binary` in
 * `apps/tauri/src-tauri/src/runtime/launch_manifest.rs`.
 */
export const resolveSpawnableRuntimeBinary = (
  installDir: string,
  profile: string,
  entry: string,
): string | null => {
  const binaryPath = path.join(installDir, entry);
  if (!fs.existsSync(binaryPath)) {
    return null;
  }
  if (!runtimeLaunchManifestDeclaresProfile(installDir, profile)) {
    return null;
  }
  if (!runtimeLaunchManifestDataFilesPresent(installDir)) {
    return null;
  }
  return binaryPath;
};
