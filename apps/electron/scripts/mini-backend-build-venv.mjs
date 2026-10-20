import { execSync } from "node:child_process";
import path from "node:path";

const buildVenvName = (profileKey) => `.venv-mini-build-${profileKey}`;

export const resolveRuntimeArtifactBuildVenvLinkPath = ({
  profileKey,
  rootDir,
}) => path.join(rootDir, buildVenvName(profileKey));

export const resolveRuntimeArtifactBuildVenvPath = ({
  profileKey,
  platform,
  externalStorageRoot,
  rootDir,
}) => {
  const venvName = buildVenvName(profileKey);
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (platform === "win32" && externalStorageRoot) {
    return pathApi.join(externalStorageRoot, venvName);
  }

  return pathApi.join(rootDir, venvName);
};

/**
 * Packages that must not appear in a given profile's build venv.
 * If `pip list` shows any package starting with these prefixes, the venv is
 * contaminated and must be recreated from scratch — otherwise PyInstaller
 * ships multi-GB CUDA DLLs into cpu/openvino zips.
 */
export const CONTAMINATION_PREFIXES = {
  cpu: ["nvidia-"],
  "intel-openvino": ["nvidia-"],
};

/** First contaminating package for the profile, or null if clean. */
export const findContaminatingPackage = (profile, pipListOutput) => {
  const forbidden = CONTAMINATION_PREFIXES[profile];
  if (!forbidden) {
    return null;
  }

  const text = String(pipListOutput || "");
  for (const prefix of forbidden) {
    for (const line of text.split("\n")) {
      const pkg = line.trim().split(/\s+/)[0];
      if (pkg && pkg.toLowerCase().startsWith(prefix)) {
        return { package: pkg, prefix };
      }
    }
  }

  return null;
};

/**
 * True when the venv is contaminated for the profile (or when pip list
 * fails — treat as contaminated for safety).
 */
export const checkVenvForContamination = (
  python,
  profile,
  { cwd, exec = execSync, log = console.log } = {},
) => {
  const forbidden = CONTAMINATION_PREFIXES[profile];
  if (!forbidden) {
    return false;
  }

  try {
    const output = exec(`"${python}" -m pip list --format=columns 2>&1`, {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 30_000,
      shell: true,
    });
    const hit = findContaminatingPackage(profile, output);
    if (hit) {
      log(
        `Profile ${profile} contaminated by ${hit.package} (prefix ${hit.prefix})`,
      );
      return true;
    }
    return false;
  } catch (error) {
    log(
      `Could not inspect venv for profile ${profile}; recreating (${String(error)})`,
    );
    return true;
  }
};
