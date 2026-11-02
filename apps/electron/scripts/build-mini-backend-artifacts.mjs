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
  writeCachedHash,
  readCachedHash,
} from "./build-cache.mjs";
import { acquireBuildLock } from "./build-lock.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const outputDirArg = process.argv[2];

if (!outputDirArg) {
  throw new Error("Usage: node scripts/build-mini-backend-artifacts.mjs <release-output-dir>");
}

// Resolve relative paths against the caller's cwd first: running from the
// repo root with an "apps/electron/..." argument used to nest under
// apps/electron/apps/electron/... and silently fork a second output tree.
// A not-yet-created dir still wins when its cwd-relative parent exists.
const releaseOutputDir = path.isAbsolute(outputDirArg)
  ? outputDirArg
  : (() => {
      const fromCwd = path.resolve(process.cwd(), outputDirArg);
      return fs.existsSync(fromCwd) || fs.existsSync(path.dirname(fromCwd))
        ? fromCwd
        : path.resolve(rootDir, outputDirArg);
    })();
if (/[\\/]apps[\\/](electron[\\/])?apps[\\/]/.test(releaseOutputDir)) {
  throw new Error(
    `output dir resolves into a nested apps/.../apps/... path: ${releaseOutputDir} — pass the path relative to your cwd`,
  );
}
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
// Regenerate manifest + .sig from the partition plans already in the output
// dir without building anything. Re-running the full script just to refresh
// the manifest used to force PyInstaller rebuilds of every profile; this flag
// makes that a seconds-long, side-effect-free operation.
const MANIFEST_ONLY = ["1", "true", "yes"].includes(
  String(process.env.MINI_BACKEND_MANIFEST_ONLY || "").trim().toLowerCase(),
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

/**
 * The base name every runtime artifact of a profile shares: the parts, the
 * partition plan and the build ledger.
 */
const runtimeArtifactBaseName = (profileKey) =>
  `mini-backend-runtime-${profileKey}-${version}-${process.platform}-${process.arch}`;

/**
 * A fingerprint of the build environment: the interpreter and the packages
 * the profile venv holds. The source hash alone cannot tell two builds of
 * the same tree apart when the interpreter or the wheels changed under it.
 */
const computeEnvironmentFingerprint = (venvPath) => {
  try {
    const python = resolveVenvPython(venvPath);
    const frozen = execSync(`"${python}" -m pip freeze --all`, {
      encoding: "utf-8",
      shell: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return createHash("sha256").update(frozen).digest("hex").slice(0, 32);
  } catch {
    return null;
  }
};

/**
 * The build ledger records which sources produced the parts in one output
 * dir. Adoption copies parts only when the sibling's ledger carries the same
 * source hash: the per-profile cache hash alone cannot tell whether those
 * bytes came from this build of the sources or from an earlier one, and two
 * builds of the same version can differ.
 */
const buildLedgerPath = (artifactsDir, zipBaseName) =>
  path.join(artifactsDir, `${zipBaseName}.build-ledger.json`);

const writeBuildLedger = (artifactsDir, zipBaseName, sourceHash, parts) => {
  fs.writeFileSync(
    buildLedgerPath(artifactsDir, zipBaseName),
    `${JSON.stringify({ sourceHash, parts }, null, 2)}\n`,
    "utf-8",
  );
};

const readBuildLedger = (artifactsDir, zipBaseName) => {
  try {
    return JSON.parse(fs.readFileSync(buildLedgerPath(artifactsDir, zipBaseName), "utf-8"));
  } catch {
    return null;
  }
};

/**
 * Reuse a complete same-version part set already sitting in a sibling release
 * dir instead of rebuilding PyInstaller (~10 min per profile). Only called
 * when the source hash already matches, so the adopted bytes come from the
 * same sources; part sizes are checked against the sibling plan and the plan
 * is copied LAST so a partial copy can never look complete.
 */
const adoptSiblingParts = (profile, zipBaseName, sourceHash, environment) => {
  const planName = `${zipBaseName}.partition-plan.json`;
  // The siblings live next to the output dir: the release desktop that holds
  // every build-* dir, or the output dir itself when it is that desktop.
  const candidates = [];
  for (const container of new Set([path.dirname(releaseOutputDir), releaseOutputDir])) {
    let entries;
    try {
      entries = fs.readdirSync(container, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      candidates.push(
        entry.name === "mini-backend-artifacts"
          ? path.join(container, entry.name)
          : path.join(container, entry.name, "mini-backend-artifacts"),
      );
    }
  }
  for (const siblingArtifacts of candidates) {
    if (path.resolve(siblingArtifacts) === path.resolve(outputRootDir)) {
      continue;
    }
    const siblingPlan = path.join(siblingArtifacts, planName);
    if (!fs.existsSync(siblingPlan)) {
      continue;
    }
    let plan;
    try {
      plan = JSON.parse(fs.readFileSync(siblingPlan, "utf-8"));
    } catch {
      continue;
    }
    const parts = Array.isArray(plan.parts) ? plan.parts : [];
    if (parts.length === 0) {
      continue;
    }
    const intact = parts.every((part) => {
      if (typeof part.file !== "string" || !isFlatAssetName(part.file)) {
        return false;
      }
      try {
        const stat = fs.statSync(path.join(siblingArtifacts, part.file));
        return stat.isFile() && stat.size === part.sizeBytes;
      } catch {
        return false;
      }
    });
    if (!intact) {
      continue;
    }
    const ledger = readBuildLedger(siblingArtifacts, zipBaseName);
    if (ledger?.sourceHash !== sourceHash || ledger?.environment !== environment) {
      continue;
    }
    for (const part of parts) {
      fs.copyFileSync(
        path.join(siblingArtifacts, part.file),
        path.join(outputRootDir, part.file),
      );
    }
    fs.copyFileSync(siblingPlan, path.join(outputRootDir, planName));
    fs.copyFileSync(
      buildLedgerPath(siblingArtifacts, zipBaseName),
      buildLedgerPath(outputRootDir, zipBaseName),
    );
    console.log(
      `[mini-backend-artifacts] ADOPTED profile=${profile} parts from ${path.relative(rootDir, siblingArtifacts)} (same sources, rebuild skipped)`,
    );
    return true;
  }
  return false;
};

/**
 * The manifest entry for one profile, read from the partition plan that sits
 * next to its parts.
 */
const buildManifestProfile = async (profile, profileKey) => {
  const zipBaseName = runtimeArtifactBaseName(profileKey);
  const zipBasePath = path.join(outputRootDir, zipBaseName);
  return {
    profile,
    version,
    platform: process.platform,
    arch: process.arch,
    entry: process.platform === "win32" ? "mini-backend.exe" : "mini-backend",
    parts: await loadRuntimePartsFromPlan(zipBasePath),
  };
};

const main = async () => {
  fs.mkdirSync(outputRootDir, { recursive: true });
  acquireBuildLock(path.join(releaseOutputDir, ".mini-backend-artifacts.lock"), {
    label: "runtime artifact build",
  });

  const profiles = getMiniBackendArtifactProfiles(process.platform, {
    includeTensorRt,
  }).filter((profileConfig) =>
    requestedProfiles.length === 0 || requestedProfiles.includes(profileConfig.profile),
  );

  if (MANIFEST_ONLY) {
    if (!resolveManifestSigningKey()) {
      throw new Error(
        "manifest-only: MINI_BACKEND_ARTIFACTS_SIGNING_KEY is unset — refusing to "
          + "rewrite the manifest unsigned, because the published feed is signature-pinned",
      );
    }
    const manifestProfiles = {};
    const missing = [];
    for (const profileConfig of profiles) {
      const profile = profileConfig.profile;
      const profileKey = sanitizeMiniBackendProfile(profile);
      const zipBaseName = runtimeArtifactBaseName(profileKey);
      const zipBasePath = path.join(outputRootDir, zipBaseName);
      if (!fs.existsSync(`${zipBasePath}.partition-plan.json`)) {
        missing.push(profile);
        continue;
      }
      manifestProfiles[profile] = await buildManifestProfile(profile, profileKey);
    }
    if (missing.length > 0) {
      throw new Error(
        `manifest-only: partition plan missing for: ${missing.join(", ")} `
          + `in ${outputRootDir} — those profiles are not built there; run a full build first`,
      );
    }
    writeRuntimeArtifactsManifest(
      buildMiniBackendRuntimeArtifactManifest({
        version,
        platform: process.platform,
        arch: process.arch,
        profiles: manifestProfiles,
      }),
    );
    console.log(
      `[mini-backend-artifacts] manifest-only: ${runtimeManifestFileName} regenerated from ${Object.keys(manifestProfiles).length} profile(s), no build`,
    );
    return;
  }

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
    const environmentFingerprint = computeEnvironmentFingerprint(profileVenvPath);
    const zipBaseName = runtimeArtifactBaseName(profileKey);
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
    const sourcesUnchanged =
      !HARDENED_RUNTIME_ARTIFACTS &&
      cachedHash === currentSourceHash;
    const partsMissing =
      cachedPartFiles === null ||
      !cachedPartFiles.every((file) => fs.existsSync(path.join(outputRootDir, file)));
    // A fresh timestamped output dir has no parts, so "cache miss" used to be
    // the default and every profile rebuilt; adopt an intact sibling copy
    // first, rebuild only when there is nothing to reuse.
    let cacheValid = sourcesUnchanged && !FORCE_REBUILD && !partsMissing;
    if (!cacheValid && sourcesUnchanged && !FORCE_REBUILD && partsMissing) {
      cacheValid = adoptSiblingParts(profile, zipBaseName, currentSourceHash, environmentFingerprint);
    }

    if (cacheValid) {
      console.log(`[mini-backend-artifacts] CACHE HIT profile=${profile} (reusing cached zip)`);
    } else {
      if (FORCE_REBUILD) {
        console.log(`[mini-backend-artifacts] FORCE REBUILD profile=${profile}`);
      } else if (!cachedHash) {
        console.log(`[mini-backend-artifacts] FIRST BUILD profile=${profile} (no cache found)`);
      } else if (cachedHash !== currentSourceHash) {
        console.log(`[mini-backend-artifacts] CACHE MISS profile=${profile} (sources changed, rebuilding)`);
      } else {
        console.log(`[mini-backend-artifacts] CACHE MISS profile=${profile} (parts missing from this output dir and no intact sibling copy, rebuilding)`);
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

    manifestProfiles[profile] = await buildManifestProfile(profile, profileKey);
    writeBuildLedger(
      outputRootDir,
      zipBaseName,
      currentSourceHash,
      environmentFingerprint,
      manifestProfiles[profile].parts,
    );
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
