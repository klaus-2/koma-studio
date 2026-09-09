import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { buildLaunchManifest } from "../electron/mini-backend-runtime.ts";
import {
  getMiniBackendArtifactProfiles,
  sanitizeMiniBackendProfile,
} from "../electron/mini-backend-artifacts.ts";
import { resolveRuntimeArtifactBuildVenvLinkPath } from "./mini-backend-build-venv.mjs";
import {
  computeMiniDepsMarkerHash,
  isMiniDepsMarkerFresh,
  writeMiniDepsMarker,
} from "./mini-deps-marker.mjs";
import {
  detectRecommendedProfile,
  expectedOnnxPackageForProfile,
  hasForceRebuildFlag,
  isTruthyEnvFlag,
  ONNX_RUNTIME_VARIANTS,
  resolveRequestedProfile,
  shouldSkipMiniBackendBuild,
} from "./mini-backend-build-options.mjs";
import {
  computeSourceHash,
  getCacheDir,
  readCachedHash,
  writeCachedHash,
} from "./build-cache.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const resolveBackendSourceDir = () => {
  const rawValue = process.env.MINI_BACKEND_SOURCE_DIR;
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return path.join(rootDir, "..", "..", "packages", "mini-backend");
  }

  const candidate = rawValue.trim();
  return path.isAbsolute(candidate) ? candidate : path.join(rootDir, candidate);
};
const backendDir = resolveBackendSourceDir();
const windowsExternalStorageRoot =
  process.platform === "win32" ? "D:\\KomaStudio\\koma-studio-storage" : null;
const miniBackendStorageDir = windowsExternalStorageRoot
  ? path.join(windowsExternalStorageRoot, "mini-backend")
  : backendDir;
const repoBuildDir = path.join(backendDir, "build");
const repoDistDir = path.join(backendDir, "dist");

const resolveEnvOverridePath = (value, fallbackPath) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallbackPath;
  }

  return path.resolve(rootDir, value.trim());
};

const resolveMiniVenvName = () => {
  const rawValue = process.env.MINI_BACKEND_VENV_NAME;
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return ".venv-mini";
  }

  return rawValue.trim();
};

const ensureWindowsJunction = (linkPath, targetPath) => {
  if (process.platform !== "win32") {
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.mkdirSync(targetPath, { recursive: true });

  if (!fs.existsSync(linkPath)) {
    fs.symlinkSync(targetPath, linkPath, "junction");
    return;
  }

  try {
    if (fs.realpathSync.native(linkPath) === fs.realpathSync.native(targetPath)) {
      return;
    }
  } catch {
    // Fall through to the conservative warning below.
  }

  const stat = fs.lstatSync(linkPath);
  if (stat.isSymbolicLink()) {
    fs.rmSync(linkPath, { recursive: true, force: true });
    fs.symlinkSync(targetPath, linkPath, "junction");
    return;
  }

  console.warn(
    `[build:mini] WARN: ${linkPath} exists and is not a junction to ${targetPath}; leaving it unchanged.`,
  );
};

const buildDir = resolveEnvOverridePath(
  process.env.MINI_BACKEND_BUILD_DIR,
  path.join(miniBackendStorageDir, "build"),
);
const distDir = resolveEnvOverridePath(
  process.env.MINI_BACKEND_DIST_DIR,
  path.join(miniBackendStorageDir, "dist"),
);

const run = (command, label, cwd = rootDir) => {
  try {
    execSync(command, {
      cwd,
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
  } catch {
    throw new Error(`${label} failed`);
  }
};

const getBackendExecutableName = () => (process.platform === "win32" ? "mini-backend.exe" : "mini-backend");
const getMiniVenvPath = () => {
  const venvName = resolveMiniVenvName();
  if (path.isAbsolute(venvName)) {
    return venvName;
  }

  return path.join(rootDir, venvName);
};

const ensureBuildVenvJunction = () => {
  if (process.platform !== "win32") {
    return;
  }

  const venvPath = getMiniVenvPath();
  const venvBaseName = path.basename(venvPath);
  if (!path.isAbsolute(venvPath) || !venvBaseName.startsWith(".venv-mini-build-")) {
    return;
  }

  const repoLinkPath = resolveRuntimeArtifactBuildVenvLinkPath({
    profileKey: venvBaseName.replace(/^\.venv-mini-build-/, ""),
    rootDir,
  });
  if (path.resolve(repoLinkPath) === path.resolve(venvPath)) {
    return;
  }

  ensureWindowsJunction(repoLinkPath, venvPath);
};

const getMiniVenvPython = () =>
  process.platform === "win32"
    ? path.join(getMiniVenvPath(), "Scripts", "python.exe")
    : path.join(getMiniVenvPath(), "bin", "python");

const ensureMiniVenv = () => {
  if (fs.existsSync(getMiniVenvPython())) {
    return;
  }

  const venvPath = getMiniVenvPath();
  if (process.platform === "win32") {
    run(`py -3.12 -m venv "${venvPath}"`, "mini:venv");
    return;
  }

  run(`python3.12 -m venv "${venvPath}"`, "mini:venv");
};

const writeLaunchManifest = (defaultProfile) => {
  const manifest = buildLaunchManifest(process.platform, process.arch, getBackendExecutableName(), {
    defaultProfile,
  });
  const outputPath = path.join(distDir, "launch-manifest.json");
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`[build:mini] launch-manifest.json atualizado para ${process.platform}/${process.arch} (defaultProfile=${defaultProfile})`);
};

const commandExists = (command) =>
  !spawnSync(command, ["--version"], { stdio: "ignore", timeout: 10_000 }).error;

// The backend's DLL auto-repair installs profile variants straight through
// ensure-mini-deps.py, which does not touch the JS marker. Probe the venv so
// a stale marker never makes a build bundle the wrong onnxruntime variant.
const resolveVenvOnnxVariants = () => {
  const probe = spawnSync(
    getMiniVenvPython(),
    [
      "-c",
      `import importlib.metadata as im\nfor name in ${JSON.stringify(ONNX_RUNTIME_VARIANTS)}:\n\ttry:\n\t\tim.version(name); print(name)\n\texcept im.PackageNotFoundError:\n\t\tpass`,
    ],
    { stdio: ["ignore", "pipe", "ignore"], timeout: 60_000, encoding: "utf8" },
  );
  if (probe.status !== 0 || typeof probe.stdout !== "string") {
    return null;
  }
  return probe.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => ONNX_RUNTIME_VARIANTS.includes(line));
};

const venvMatchesProfile = (profile) => {
  const variants = resolveVenvOnnxVariants();
  if (variants === null) {
    return false;
  }
  const expected = expectedOnnxPackageForProfile(profile);
  return variants.includes(expected);
};

const selectProfileInteractively = async (platformProfiles, recommended) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n[build:mini] Choose the acceleration profile for this build:");
  platformProfiles.forEach((candidate, index) => {
    const suffix = candidate === recommended ? "  (recommended for this machine)" : "";
    console.log(`  ${index + 1}) ${candidate}${suffix}`);
  });

  const answer = (await rl.question(
    `Profile [1-${platformProfiles.length}, number or name, Enter = ${recommended}]: `,
  )).trim();
  rl.close();

  if (!answer) {
    return { profile: recommended, source: "interactive-default" };
  }

  const numericIndex = Number.parseInt(answer, 10);
  if (
    Number.isInteger(numericIndex) &&
    numericIndex >= 1 &&
    numericIndex <= platformProfiles.length
  ) {
    return { profile: platformProfiles[numericIndex - 1], source: "interactive" };
  }

  const namedProfile = answer.toLowerCase();
  if (platformProfiles.includes(namedProfile)) {
    return { profile: namedProfile, source: "interactive" };
  }

  throw new Error(
    `Invalid profile '${answer}'. Valid options: ${platformProfiles.join(", ")}`,
  );
};

const useDefaultWindowsStorageDirs =
  process.platform === "win32" &&
  windowsExternalStorageRoot &&
  !process.env.MINI_BACKEND_BUILD_DIR &&
  !process.env.MINI_BACKEND_DIST_DIR;

const resolveBuildProfile = async () => {
  const platformProfiles = getMiniBackendArtifactProfiles(process.platform, {
    includeTensorRt: true,
  }).map((entry) => entry.profile);

  const requested = resolveRequestedProfile({
    argv: process.argv.slice(2),
    envProfile: process.env.MINI_BACKEND_ACCELERATION_PROFILE,
  });

  if (requested.profile) {
    if (!platformProfiles.includes(requested.profile)) {
      throw new Error(
        `Profile '${requested.profile}' is not valid for ${process.platform}. Options: ${platformProfiles.join(", ")}`,
      );
    }
    console.log(`[build:mini] profile=${requested.profile} (from ${requested.source})`);
    return requested.profile;
  }

  if (process.stdin.isTTY && process.stdout.isTTY) {
    const recommended = detectRecommendedProfile({
      platform: process.platform,
      arch: process.arch,
      commandExists,
    });
    const selection = await selectProfileInteractively(platformProfiles, recommended);
    console.log(`[build:mini] profile=${selection.profile} (from ${selection.source})`);
    return selection.profile;
  }

  console.log(
    "[build:mini] no profile requested and no interactive terminal — using profile=cpu (use --profile <profile> or MINI_BACKEND_ACCELERATION_PROFILE to choose)",
  );
  return "cpu";
};

const main = async () => {
  const profile = await resolveBuildProfile();
  // Drives ensure-mini-deps.py wheel selection and PyInstaller DLL bundling,
  // and is inherited by any child process spawned from here on.
  process.env.MINI_BACKEND_ACCELERATION_PROFILE = profile;
  const profileKey = sanitizeMiniBackendProfile(profile);

  const cacheDir = getCacheDir(rootDir, `mini-backend-profile-${profileKey}`);
  const sourceHash = computeSourceHash([
    backendDir,
    path.join(rootDir, "scripts"),
  ]);
  const forceRebuild =
    hasForceRebuildFlag(process.argv.slice(2)) ||
    isTruthyEnvFlag(process.env.MINI_BACKEND_FORCE_REBUILD);
  const distArtifactExists =
    fs.existsSync(path.join(distDir, getBackendExecutableName())) &&
    fs.existsSync(path.join(distDir, "launch-manifest.json"));

  if (
    shouldSkipMiniBackendBuild({
      forceRebuild,
      customSourceDir: Boolean(
        typeof process.env.MINI_BACKEND_SOURCE_DIR === "string" &&
          process.env.MINI_BACKEND_SOURCE_DIR.trim().length > 0,
      ),
      cachedHash: readCachedHash(cacheDir),
      currentHash: sourceHash,
      distArtifactExists,
    })
  ) {
    console.log(
      `[build:mini] CACHE HIT profile=${profile} — sources unchanged since the last build, reusing ${distDir}`,
    );
    writeLaunchManifest(profile);
    return;
  }

  if (useDefaultWindowsStorageDirs) {
    ensureWindowsJunction(repoBuildDir, buildDir);
    ensureWindowsJunction(repoDistDir, distDir);
  }

  ensureBuildVenvJunction();

  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.rmSync(distDir, { recursive: true, force: true });

  ensureMiniVenv();

  const depsMarkerHash = computeMiniDepsMarkerHash(rootDir, { profile });
  if (
    isMiniDepsMarkerFresh(getMiniVenvPath(), depsMarkerHash) &&
    venvMatchesProfile(profile)
  ) {
    console.log(
      `[build:mini] Python dependencies already installed for profile '${profile}' (compatible marker + onnxruntime variant). Skipping mini:install-deps.`,
    );
  } else {
    run(`"${getMiniVenvPython()}" scripts/ensure-mini-deps.py`, "mini:install-deps");
    writeMiniDepsMarker(getMiniVenvPath(), depsMarkerHash);
  }

  // Guard: an orphaned onnxruntime install would make PyInstaller silently
  // skip it (bundle without OCR) and then poison the build cache.
  run(`"${getMiniVenvPython()}" -c "import onnxruntime"`, "verify-onnxruntime");

  run(
    `"${getMiniVenvPython()}" -m PyInstaller --distpath "${distDir}" --workpath "${buildDir}" build.spec`,
    "pyinstaller",
    backendDir,
  );

  // PyInstaller onedir creates distDir/mini-backend/<files>.
  // Flatten the subdirectory so files sit directly in distDir (same layout the
  // rest of the pipeline expects from the old onefile mode).
  const onedirSubdir = path.join(distDir, "mini-backend");
  if (fs.existsSync(onedirSubdir) && fs.statSync(onedirSubdir).isDirectory()) {
    for (const entry of fs.readdirSync(onedirSubdir)) {
      fs.renameSync(path.join(onedirSubdir, entry), path.join(distDir, entry));
    }
    fs.rmSync(onedirSubdir, { recursive: true, force: true });
  }

  writeLaunchManifest(profile);
  run("node scripts/cleanup-build-caches.mjs", "cleanup-build-caches");

  // Write cache hash so subsequent builds can skip if sources unchanged.
  writeCachedHash(cacheDir, sourceHash);
  console.log(`[build:mini] cache hash written for profile=${profileKey}`);
};

main().catch((error) => {
  console.error(`[build:mini] error: ${error.message}`);
  process.exit(1);
});
