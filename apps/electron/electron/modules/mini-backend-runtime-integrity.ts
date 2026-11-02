/**
 * Runtime install paths + artifact integrity hash.
 */
import { app } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  sanitizeMiniBackendProfile,
} from "../mini-backend-artifacts.ts";
import { resolveSpawnableRuntimeBinary } from "../mini-backend-runtime-launch-manifest.ts";
import type { MiniBackendAccelerationProfile } from "../mini-backend-runtime.ts";

const computeSha512Base64ForFile = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });

const getMiniBackendRuntimeInstallDir = (
  version: string,
  profile: MiniBackendAccelerationProfile,
): string =>
  path.join(
    app.getPath("userData"),
    "mini-backend-runtimes",
    version,
    sanitizeMiniBackendProfile(profile),
  );

/**
 * Whether the profile is installed AND spawnable. The runtime panel and the
 * spawn guard must agree: a profile the shell would refuse to start is not an
 * installed profile.
 */
const isMiniBackendRuntimeInstalled = (
  version: string,
  profile: MiniBackendAccelerationProfile,
  entry: string,
): boolean => {
  const installDir = getMiniBackendRuntimeInstallDir(version, profile);
  return resolveSpawnableRuntimeBinary(installDir, profile, entry) !== null;
};

export {
  computeSha512Base64ForFile,
  getMiniBackendRuntimeInstallDir,
  isMiniBackendRuntimeInstalled,
};
