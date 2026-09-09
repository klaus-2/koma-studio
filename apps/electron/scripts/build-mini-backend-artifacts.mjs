import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMiniBackendRuntimeArtifactManifest,
  getMiniBackendArtifactProfiles,
  sanitizeMiniBackendProfile,
} from "../electron/mini-backend-artifacts.ts";
import { resolveRuntimeArtifactBuildVenvPath } from "./mini-backend-build-venv.mjs";
import {
  computeMiniDepsMarkerHash,
  isMiniDepsMarkerFresh,
  writeMiniDepsMarker,
} from "./mini-deps-marker.mjs";
import {
  computeSourceHash,
  getCacheDir,
  isCacheValid,
  writeCachedHash,
  readCachedHash,
} from "./build-cache.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const outputDirArg = process.argv[2];

if (!outputDirArg) {
  throw new Error("Usage: node scripts/build-mini-backend-artifacts.mjs <release-output-dir>");
}

const releaseOutputDir = path.resolve(rootDir, outputDirArg);
const outputRootDir = path.join(releaseOutputDir, "mini-backend-artifacts");
const workRootDir = path.join(outputRootDir, "work");
const externalStorageRoot =
  process.platform === "win32"
    ? "D:\\KomaStudio\\koma-studio-storage"
    : null;

const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"),
);
const version = String(packageJson.version || "").trim();

if (!version) {
  throw new Error("package.json version not found");
}

const run = (command, label, envOverrides = {}) => {
  try {
    execSync(command, {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        ...envOverrides,
      },
      shell: true,
    });
  } catch {
    throw new Error(`${label} failed`);
  }
};

const compressDirectoryToZip = (sourceDir, outputZipPath) => {
  if (process.platform === "win32") {
    const escapedSource = sourceDir.replace(/'/g, "''");
    const escapedZip = outputZipPath.replace(/'/g, "''");
    run(
      `powershell -NoProfile -Command "Compress-Archive -Path '${escapedSource}\\*' -DestinationPath '${escapedZip}' -Force"`,
      `zip:${path.basename(outputZipPath)}`,
    );
    return;
  }

  const escapedSource = sourceDir.replace(/\\/g, "/").replace(/'/g, "\\'");
  const escapedZipBase = outputZipPath
    .replace(/\\/g, "/")
    .replace(/'/g, "\\'")
    .replace(/\.zip$/i, "");
  run(
    `python3 -c "import shutil; shutil.make_archive('${escapedZipBase}', 'zip', '${escapedSource}')"`,
    `zip:${path.basename(outputZipPath)}`,
  );
};

const computeSha512Base64 = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });

const includeTensorRt = ["1", "true", "yes"].includes(
  String(process.env.MINI_BACKEND_INCLUDE_TENSORRT || "").trim().toLowerCase(),
);
const requestedProfiles = String(process.env.MINI_BACKEND_ARTIFACT_PROFILES || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const FORCE_REBUILD = ["1", "true", "yes"].includes(
  String(process.env.MINI_BACKEND_FORCE_REBUILD || "").trim().toLowerCase(),
);
const SKIP_RUNTIME_ARTIFACTS = ["1", "true", "yes"].includes(
  String(process.env.MINI_BACKEND_SKIP_RUNTIME_ARTIFACTS || "").trim().toLowerCase(),
);
const HARDENED_RUNTIME_ARTIFACTS = ["1", "true", "yes"].includes(
  String(process.env.MINI_BACKEND_ARTIFACTS_HARDENED || "").trim().toLowerCase(),
);
const SKIP_HARDEN_CYTHON = ["1", "true", "yes"].includes(
  String(process.env.MINI_BACKEND_HARDEN_SKIP_CYTHON || "").trim().toLowerCase(),
);
const SKIP_HARDEN_PYARMOR = ["1", "true", "yes"].includes(
  String(process.env.MINI_BACKEND_HARDEN_SKIP_PYARMOR || "").trim().toLowerCase(),
);

const getProfileSourceDirs = () => {
  const dirs = [
    path.join(rootDir, "..", "..", "packages", "mini-backend"),
    path.join(rootDir, "scripts"),
  ];
  return dirs;
};

const getProfileCacheKey = (profileKey) =>
  `mini-backend-profile-${profileKey}${HARDENED_RUNTIME_ARTIFACTS ? "-hardened" : ""}`;

const resolveVenvPython = (venvPath) =>
  process.platform === "win32"
    ? path.join(venvPath, "Scripts", "python.exe")
    : path.join(venvPath, "bin", "python");

const ensureBuildVenv = (venvPath) => {
  if (fs.existsSync(resolveVenvPython(venvPath))) {
    return;
  }

  if (process.platform === "win32") {
    run(`py -3.12 -m venv "${venvPath}"`, `mini:venv:${path.basename(venvPath)}`);
    return;
  }

  run(`python3.12 -m venv "${venvPath}"`, `mini:venv:${path.basename(venvPath)}`);
};

const buildProfileHardenedSource = ({
  profile,
  profileKey,
  workDir,
  profileVenvPath,
}) => {
  ensureBuildVenv(profileVenvPath);
  const python = resolveVenvPython(profileVenvPath);
  const hardenedDir = path.join(workDir, `mini-backend-hardened-${profileKey}`);
  const hardenArgs = [];
  if (SKIP_HARDEN_CYTHON) hardenArgs.push("--skip-cython");
  if (SKIP_HARDEN_PYARMOR) hardenArgs.push("--skip-pyarmor");

  const depsMarkerHash = computeMiniDepsMarkerHash(rootDir, { profile });
  if (isMiniDepsMarkerFresh(profileVenvPath, depsMarkerHash)) {
    console.log(`[mini-backend-artifacts] deps marker hit profile=${profile}, skipping mini:install-deps`);
  } else {
    run(`"${python}" scripts/ensure-mini-deps.py`, `mini:install-deps:${profile}`, {
      MINI_BACKEND_ACCELERATION_PROFILE: profile,
      MINI_BACKEND_VENV_NAME: profileVenvPath,
    });
    writeMiniDepsMarker(profileVenvPath, depsMarkerHash);
  }

  run(`"${python}" -m pip install cython pyarmor --quiet`, `install-hardening-deps:${profile}`);

  run(
    `"${python}" scripts/harden-mini-backend.py ${hardenArgs.join(" ")}`.trim(),
    `harden-mini-backend:${profile}`,
    {
      MINI_BACKEND_ACCELERATION_PROFILE: profile,
      MINI_BACKEND_VENV_NAME: profileVenvPath,
      MINI_BACKEND_HARDENED_DIR: hardenedDir,
      MINI_BACKEND_DISABLE_EXTERNAL_STORAGE_JUNCTIONS: "1",
    },
  );

  return hardenedDir;
};

const main = async () => {
  fs.mkdirSync(outputRootDir, { recursive: true });
  fs.rmSync(workRootDir, { recursive: true, force: true });
  fs.mkdirSync(workRootDir, { recursive: true });

  if (SKIP_RUNTIME_ARTIFACTS) {
    const manifest = buildMiniBackendRuntimeArtifactManifest({
      version,
      platform: process.platform,
      arch: process.arch,
      profiles: {},
    });
    fs.writeFileSync(
      path.join(outputRootDir, "latest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf-8",
    );
    fs.rmSync(workRootDir, { recursive: true, force: true });
    console.log("[mini-backend-artifacts] runtime artifacts skipped by configuration");
    return;
  }

  const profiles = getMiniBackendArtifactProfiles(process.platform, {
    includeTensorRt,
  }).filter((profileConfig) =>
    requestedProfiles.length === 0 || requestedProfiles.includes(profileConfig.profile),
  );
  const manifestProfiles = {};

  const sourceDirs = getProfileSourceDirs();
  const currentSourceHash = computeSourceHash(sourceDirs);

  for (const profileConfig of profiles) {
    const profile = profileConfig.profile;
    const profileKey = sanitizeMiniBackendProfile(profile);
    const workDir = path.join(workRootDir, profileKey);
    const distDir = path.join(workDir, "dist");
    const buildDir = path.join(workDir, "build");
    const profileVenvPath = resolveRuntimeArtifactBuildVenvPath({
      profileKey,
      platform: process.platform,
      externalStorageRoot,
      rootDir,
    });
    const zipFileName = `mini-backend-runtime-${profileKey}-${version}-${process.platform}-${process.arch}.zip`;
    const zipFilePath = path.join(outputRootDir, zipFileName);

    const cacheDir = getCacheDir(rootDir, getProfileCacheKey(profileKey));
    const cachedHash = readCachedHash(cacheDir);
    const cacheValid =
      !HARDENED_RUNTIME_ARTIFACTS &&
      !FORCE_REBUILD &&
      cachedHash === currentSourceHash &&
      fs.existsSync(zipFilePath);

    if (cacheValid) {
      console.log(`[mini-backend-artifacts] CACHE HIT profile=${profile} (reusing cached zip)`);
    } else {
      if (FORCE_REBUILD) {
        console.log(`[mini-backend-artifacts] FORCE REBUILD profile=${profile}`);
      } else if (!cachedHash) {
        console.log(`[mini-backend-artifacts] FIRST BUILD profile=${profile} (no cache found)`);
      } else {
        console.log(`[mini-backend-artifacts] CACHE MISS profile=${profile} (sources changed, rebuilding)`);
      }

      fs.rmSync(workDir, { recursive: true, force: true });
      fs.mkdirSync(workDir, { recursive: true });

      const profileSourceDir = HARDENED_RUNTIME_ARTIFACTS
        ? buildProfileHardenedSource({
            profile,
            profileKey,
            workDir,
            profileVenvPath,
          })
        : "mini-backend";

      try {
        run("node scripts/build-mini-backend.mjs", `build-mini-backend:${profile}`, {
          MINI_BACKEND_ACCELERATION_PROFILE: profile,
          MINI_BACKEND_SOURCE_DIR: profileSourceDir,
          MINI_BACKEND_VENV_NAME: profileVenvPath,
          MINI_BACKEND_DIST_DIR: distDir,
          MINI_BACKEND_BUILD_DIR: buildDir,
          ...(FORCE_REBUILD ? { MINI_BACKEND_FORCE_REBUILD: "1" } : {}),
        });
      } catch (error) {
        if (!profileConfig.optional) {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[mini-backend-artifacts] optional profile skipped: ${profile} (${message})`);
        continue;
      }

      compressDirectoryToZip(distDir, zipFilePath);

      writeCachedHash(cacheDir, currentSourceHash);
      console.log(`[mini-backend-artifacts] profile=${profile} built and cached`);

      fs.rmSync(workDir, { recursive: true, force: true });
    }

    manifestProfiles[profile] = {
      profile,
      version,
      platform: process.platform,
      arch: process.arch,
      fileName: zipFileName,
      url: zipFileName,
      sha512: await computeSha512Base64(zipFilePath),
      size: fs.statSync(zipFilePath).size,
      entry: process.platform === "win32" ? "mini-backend.exe" : "mini-backend",
    };
  }

  const manifest = buildMiniBackendRuntimeArtifactManifest({
    version,
    platform: process.platform,
    arch: process.arch,
    profiles: manifestProfiles,
  });

  fs.writeFileSync(
    path.join(outputRootDir, "latest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );
  fs.rmSync(workRootDir, { recursive: true, force: true });
  console.log(
    `[mini-backend-artifacts] completed with ${Object.keys(manifestProfiles).length} profile artifact(s)`,
  );
};

main().catch((error) => {
  console.error(`[mini-backend-artifacts] error: ${error.message}`);
  process.exit(1);
});
