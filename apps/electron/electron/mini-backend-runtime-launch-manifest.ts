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
export const runtimeLaunchManifestDeclaresProfile = (
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
