import { execSync } from "node:child_process";
import { createHash, createPrivateKey, sign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMiniBackendRuntimeArtifactManifest,
  getMiniBackendArtifactProfiles,
  sanitizeMiniBackendProfile,
} from "../electron/mini-backend-artifacts.ts";
import {
  checkVenvForContamination,
  resolveRuntimeArtifactBuildVenvPath,
} from "./mini-backend-build-venv.mjs";
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

const RUNTIME_PART_BUDGET_BYTES = Math.floor(1.9 * 1024 ** 3);
// Parts live on immutable runtime-v<version> releases; the manifest embeds
// absolute tag-pinned URLs so a "latest" flip can never redirect a download.
const RUNTIME_PARTS_URL_BASE =
  "https://github.com/klaus-2/koma-studio/releases/download/";

const resolveZipPythonCommand = () =>
  process.platform === "win32" ? "py -3.12" : "python3";

// GitHub release assets are flat; reject anything that could become a path.
const isFlatAssetName = (name) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name);

const removeStalePartOutputs = (zipBaseName) => {
  for (const name of fs.readdirSync(outputRootDir)) {
    if (
      name === `${zipBaseName}.zip`
      || name === `${zipBaseName}.partition-plan.json`
      || (name.startsWith(`${zipBaseName}.part-`) && name.endsWith(".zip"))
    ) {
      fs.rmSync(path.join(outputRootDir, name), { force: true });
    }
  }
};

const loadRuntimePartsFromPlan = async (zipBasePath) => {
  const planPath = `${zipBasePath}.partition-plan.json`;
  const plan = JSON.parse(fs.readFileSync(planPath, "utf-8"));
  const parts = [];
  for (const part of plan.parts) {
    if (!isFlatAssetName(part.file)) {
      throw new Error(`runtime part asset name is not flat: ${part.file}`);
    }
    parts.push({
      file: part.file,
      url: `${RUNTIME_PARTS_URL_BASE}runtime-v${version}/${part.file}`,
      sha512: await computeSha512Base64(path.join(outputRootDir, part.file)),
      size: fs.statSync(path.join(outputRootDir, part.file)).size,
    });
  }
  return parts;
};

// Zips are produced by the python partitioner on every platform: forward-slash
// entries, one independent zip per part, each under the byte budget.
const partitionDistIntoRuntimeParts = async ({ distDir, zipBasePath }) => {
  const zipBaseName = path.basename(zipBasePath);
  removeStalePartOutputs(zipBaseName);
  run(
    `${resolveZipPythonCommand()} "${path.join(__dirname, "zip-runtime-parts.py")}" `
      + `--source-dir "${distDir}" --output-base "${zipBasePath}" `
      + `--budget-bytes ${RUNTIME_PART_BUDGET_BYTES}`,
    `partition:${zipBaseName}`,
  );
  return loadRuntimePartsFromPlan(zipBasePath);
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

/**
 * Ensure a clean per-profile build venv. Recreate when packages outside the
 * profile scope are present (e.g. nvidia-* in cpu/openvino) so PyInstaller
 * does not ship multi-GB polluted DLLs.
 */
const ensureBuildVenv = (venvPath, profile) => {
  const python = resolveVenvPython(venvPath);
  if (fs.existsSync(python)) {
    if (
      checkVenvForContamination(python, profile, {
        cwd: rootDir,
        log: (message) => console.log(`[mini-backend-artifacts] ${message}`),
      })
    ) {
      console.log(
        `[mini-backend-artifacts] Recreating contaminated venv ${path.basename(venvPath)} ...`,
      );
      fs.rmSync(venvPath, { recursive: true, force: true });
    } else {
      return;
    }
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
  ensureBuildVenv(profileVenvPath, profile);
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

  run(`"${python}" -m pip install --upgrade pip==26.2.2 --quiet`, `upgrade-pip:${profile}`);
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

const resolveManifestSigningKey = () => {
  const raw = (process.env.MINI_BACKEND_ARTIFACTS_SIGNING_KEY || "").trim();
  if (!raw) {
    return null;
  }
  if (raw.includes("BEGIN")) {
    return createPrivateKey(raw.replace(/\\n/g, "\n"));
  }
  return createPrivateKey({
    key: Buffer.from(raw, "base64"),
    format: "der",
    type: "pkcs8",
  });
};

/**
 * Writes the per-platform manifest `mini-backend-latest-{platform}-{arch}.json`
 * and, when a signing key is provisioned, its detached `.sig` twin over the
 * exact published bytes. Consumers pin the public key at build time, so the
 * feed no longer relies on TLS alone. Publishing an unsigned manifest is
 * rejected later by the publish choreography, not here: CI legitimately
 * produces unsigned manifests that the local signing machine finalizes.
 */
const runtimeManifestFileName = `mini-backend-latest-${process.platform}-${process.arch}.json`;
const writeRuntimeArtifactsManifest = (manifest) => {
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(path.join(outputRootDir, runtimeManifestFileName), body, "utf-8");

  for (const staleName of ["latest.json", "latest.json.sig"]) {
    fs.rmSync(path.join(outputRootDir, staleName), { force: true });
  }

  const signaturePath = path.join(outputRootDir, `${runtimeManifestFileName}.sig`);
  const signingKey = resolveManifestSigningKey();
  if (!signingKey) {
    fs.rmSync(signaturePath, { force: true });
    console.warn(
      "[mini-backend-artifacts] MINI_BACKEND_ARTIFACTS_SIGNING_KEY is unset; manifest is unsigned (finalize with the local signing step before publishing)",
    );
    return;
  }
  const signature = sign(null, Buffer.from(body, "utf-8"), signingKey);
  fs.writeFileSync(signaturePath, `ed25519-${signature.toString("base64")}\n`, "utf-8");
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
    writeRuntimeArtifactsManifest(manifest);
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
    const zipBaseName = `mini-backend-runtime-${profileKey}-${version}-${process.platform}-${process.arch}`;
    const zipBasePath = path.join(outputRootDir, zipBaseName);
    const planPath = `${zipBasePath}.partition-plan.json`;
    const readCachedPlanPartFiles = () => {
      try {
        const files = JSON.parse(fs.readFileSync(planPath, "utf-8")).parts.map((part) => part.file);
        return files.length > 0 ? files : null;
      } catch {
        return null;
      }
    };
    const cachedPartFiles = readCachedPlanPartFiles();

    const cacheDir = getCacheDir(rootDir, getProfileCacheKey(profileKey));
    const cachedHash = readCachedHash(cacheDir);
    const cacheValid =
      !HARDENED_RUNTIME_ARTIFACTS &&
      !FORCE_REBUILD &&
      cachedHash === currentSourceHash &&
      cachedPartFiles !== null &&
      cachedPartFiles.every((file) => fs.existsSync(path.join(outputRootDir, file)));

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
        // Absolute path: MINI_BACKEND_SOURCE_DIR resolves relative values
        // against apps/electron, so a bare "mini-backend" would point at a
        // nonexistent directory and break install-deps/pyinstaller cwd.
        : path.join(rootDir, "..", "..", "packages", "mini-backend");

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

      await partitionDistIntoRuntimeParts({ distDir, zipBasePath });

      writeCachedHash(cacheDir, currentSourceHash);
      console.log(`[mini-backend-artifacts] profile=${profile} built and cached`);

      fs.rmSync(workDir, { recursive: true, force: true });
    }

    manifestProfiles[profile] = {
      profile,
      version,
      platform: process.platform,
      arch: process.arch,
      entry: process.platform === "win32" ? "mini-backend.exe" : "mini-backend",
      parts: await loadRuntimePartsFromPlan(zipBasePath),
    };
  }

  const manifest = buildMiniBackendRuntimeArtifactManifest({
    version,
    platform: process.platform,
    arch: process.arch,
    profiles: manifestProfiles,
  });

  writeRuntimeArtifactsManifest(manifest);
  fs.rmSync(workRootDir, { recursive: true, force: true });
  console.log(
    `[mini-backend-artifacts] completed with ${Object.keys(manifestProfiles).length} profile artifact(s)`,
  );
};

main().catch((error) => {
  console.error(`[mini-backend-artifacts] error: ${error.message}`);
  process.exit(1);
});
