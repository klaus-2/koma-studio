/**
 * Orchestrates the V2 hardened Tauri release pipeline.
 *
 * Pipeline:
 *   0. Pick the hardware acceleration profile to bake into the sidecar
 *   1. Harden mini-backend with the v1 Cython + PyArmor pipeline
 *   2. Build the React renderer with Vite
 *   3. Harden renderer bundles with the v1 obfuscation/SRI pass
 *   4. Stage the PyInstaller binary as a Tauri sidecar
 *   5. Run tauri build with updater signing and Windows signing hooks
 *   6. Verify hardening outputs
 *
 * Hardware profiles: step 0 asks which acceleration profile to build (CPU,
 * NVIDIA CUDA, AMD ROCm, Intel OpenVINO, Apple Metal). The answer selects the
 * `mini-backend/requirements*.txt` installed into `.venv-mini`, which in turn
 * decides which native libraries PyInstaller finds and freezes. The result is
 * one sidecar carrying the chosen profile — the profile *replaces* the CPU set
 * rather than being emitted alongside it. Pass `--profile <id>` or set
 * $KOMA_BUILD_PROFILE to skip the prompt; a non-TTY build defaults to `cpu`.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findProfile } from "./lib/hardware-profiles.mjs";
import {
  PROFILE_ENV_VAR,
  resolveHardwareProfile,
} from "./lib/prompt-hardware-profile.mjs";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const skipMini = args.includes("--skip-mini");
const skipCython = args.includes("--skip-cython");
const skipPyarmor = args.includes("--skip-pyarmor");
const skipObfuscator = args.includes("--skip-obfuscator");
const skipTauri = args.includes("--skip-tauri");
const keepSourcemaps = args.includes("--keep-sourcemaps");
const embedMiniBackend =
  args.includes("--embed-mini-backend") || process.env.KOMA_EMBED_MINI_BACKEND === "1";
const platformIdx = args.indexOf("--platform");
const rawTargetPlatform = platformIdx >= 0 ? args[platformIdx + 1] : process.platform;
const targetPlatform =
  rawTargetPlatform === "win32" ? "win" : rawTargetPlatform === "darwin" ? "mac" : rawTargetPlatform;
const targetIdx = args.indexOf("--target");
const explicitTargetTriple = targetIdx >= 0 ? args[targetIdx + 1] : null;
const profileIdx = args.indexOf("--profile");
const explicitProfile = profileIdx >= 0 ? args[profileIdx + 1] : null;
const heavyNodeHeapMb = process.env.HARDEN_NODE_MAX_OLD_SPACE_SIZE || "8192";

const totalSteps = 5;
const startTime = Date.now();

const log = (msg) => console.log(`[hardened-release] ${msg}`);
const logStep = (step, msg) => console.log(`\n[${step}/${totalSteps}] ${msg}`);

const quote = (value) => `"${String(value).replace(/"/g, '\\"')}"`;

const run = (command, label, { cwd = rootDir, timeout = 900_000, env = {} } = {}) => {
  log(`$ ${command}`);
  execSync(command, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    shell: true,
    stdio: "inherit",
    timeout,
  });
  log(`${label} complete`);
};

const resolveMiniVenvPython = () => {
  const venvName = process.env.MINI_BACKEND_VENV_NAME || ".venv-mini";
  const base = path.isAbsolute(venvName) ? venvName : path.join(rootDir, venvName);
  return process.platform === "win32"
    ? path.join(base, "Scripts", "python.exe")
    : path.join(base, "bin", "python");
};

const getHostTriple = () => {
  if (explicitTargetTriple) return explicitTargetTriple;
  return execSync("rustc --print host-tuple", { cwd: rootDir, encoding: "utf8" }).trim();
};

const getSidecarExtension = () => (targetPlatform === "win" || process.platform === "win32" ? ".exe" : "");

const getMiniExecutableName = () => (process.platform === "win32" ? "mini-backend.exe" : "mini-backend");

const resolveCythonBuildEnv = () =>
  targetPlatform === "win" || process.platform === "win32"
    ? {
      DISTUTILS_USE_SDK: "1",
      MSSdk: "1",
    }
    : {};

const resolveSidecarDir = () => path.join(rootDir, "src-tauri", "bin");

const cleanTauriSidecarStage = () => {
  fs.rmSync(resolveSidecarDir(), { recursive: true, force: true });
};

const sizeOfPathBytes = (target) => {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;
  return fs
    .readdirSync(target)
    .reduce((total, entry) => total + sizeOfPathBytes(path.join(target, entry)), 0);
};

const flattenPyInstallerOnedir = (distDir) => {
  const onedirSubdir = path.join(distDir, "mini-backend");
  if (!fs.existsSync(onedirSubdir) || !fs.statSync(onedirSubdir).isDirectory()) {
    return;
  }

  for (const entry of fs.readdirSync(onedirSubdir)) {
    const source = path.join(onedirSubdir, entry);
    const destination = path.join(distDir, entry);
    fs.cpSync(source, destination, { recursive: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
  fs.rmSync(onedirSubdir, { recursive: true, force: true });
};

/** Name of the marker file that records which profile a sidecar was built for. */
const PROFILE_MANIFEST_NAME = "mini-backend-profile.json";

/**
 * Record the baked-in profile next to the frozen binary.
 *
 * The sidecar itself carries the profile implicitly, as whichever native
 * libraries PyInstaller froze — which is unreadable after the fact. This
 * manifest makes it inspectable: support can ask a user for one small JSON
 * file instead of guessing why CUDA is not engaging on their machine. It is
 * written into the dist directory before staging, so it is copied along with
 * everything else.
 */
const writeProfileManifest = (distDir, buildProfile) => {
  const profile = findProfile(buildProfile);
  fs.writeFileSync(
    path.join(distDir, PROFILE_MANIFEST_NAME),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        profile: buildProfile,
        label: profile?.label ?? buildProfile,
        platform: targetPlatform,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  log(`Sidecar profile manifest written: ${PROFILE_MANIFEST_NAME} (profile "${buildProfile}")`);
};

const stageTauriSidecar = (sourceDistDir) => {
  const targetTriple = getHostTriple();
  const sidecarDir = resolveSidecarDir();
  const sourceBinary = path.join(sourceDistDir, getMiniExecutableName());
  const targetBinary = path.join(sidecarDir, `mini-backend-${targetTriple}${getSidecarExtension()}`);

  if (!fs.existsSync(sourceBinary)) {
    throw new Error(`Mini-backend executable not found at ${sourceBinary}`);
  }

  fs.rmSync(sidecarDir, { recursive: true, force: true });
  fs.mkdirSync(sidecarDir, { recursive: true });
  fs.copyFileSync(sourceBinary, targetBinary);
  fs.chmodSync(targetBinary, 0o755);

  for (const entry of fs.readdirSync(sourceDistDir)) {
    if (entry === path.basename(sourceBinary)) continue;
    const source = path.join(sourceDistDir, entry);
    const destination = path.join(sidecarDir, entry);
    fs.cpSync(source, destination, { recursive: true });
  }

  log(`Staged sidecar ${path.relative(rootDir, targetBinary)} for ${targetTriple}`);
  return { targetBinary, targetTriple };
};

const buildHardenedMiniBackend = (buildProfile) => {
  // The profile travels as an environment variable rather than an extra CLI
  // argument because `bun run` forwards the environment but mangles trailing
  // args. `mini-venv.mjs` reads $KOMA_BUILD_PROFILE with the same precedence
  // it gives `--profile`, so this is the whole handoff.
  run("bun run mini:install-deps", `mini dependencies (profile "${buildProfile}")`, {
    timeout: 1_800_000,
    env: { [PROFILE_ENV_VAR]: buildProfile },
  });

  const python = resolveMiniVenvPython();
  run(`${quote(python)} -m pip install cython pyarmor --quiet`, "hardening dependencies", {
    timeout: 600_000,
  });

  const hardenArgs = [];
  if (skipCython) hardenArgs.push("--skip-cython");
  if (skipPyarmor) hardenArgs.push("--skip-pyarmor");
  run(`${quote(python)} scripts/harden-mini-backend.py ${hardenArgs.join(" ")}`, "mini hardening", {
    timeout: 3_600_000,
    env: resolveCythonBuildEnv(),
  });

  const hardenedDir = path.join(rootDir, "mini-backend-hardened");
  const distDir = path.join(hardenedDir, "dist");
  const buildDir = path.join(hardenedDir, "build");
  const specPath = path.join(hardenedDir, "build.spec");

  if (!fs.existsSync(specPath)) {
    throw new Error(`Hardened PyInstaller spec not found at ${specPath}`);
  }

  // `build.spec` collects the `nvidia.*` / onnxruntime provider libraries by
  // probing the interpreter it runs under, and that interpreter is the venv
  // provisioned above. The profile therefore determines what gets frozen with
  // no spec changes at all; the variable is exported so any profile-aware hook
  // sees the same value the venv was built for.
  run(
    `${quote(python)} -m PyInstaller -y --distpath ${quote(distDir)} --workpath ${quote(buildDir)} ${quote(specPath)}`,
    "pyinstaller hardened mini-backend",
    {
      cwd: hardenedDir,
      timeout: 3_600_000,
      env: { MINI_BACKEND_ACCELERATION_PROFILE: buildProfile },
    },
  );

  flattenPyInstallerOnedir(distDir);
  writeProfileManifest(distDir, buildProfile);
  signWindowsArtifact(path.join(distDir, getMiniExecutableName()), "mini-backend runtime");

  const standardDist = path.join(rootDir, "..", "..", "packages", "mini-backend", "dist");
  fs.rmSync(standardDist, { recursive: true, force: true });
  fs.cpSync(distDir, standardDist, { recursive: true });

  if (!embedMiniBackend) {
    cleanTauriSidecarStage();
    log(
      `Thin runtime mode enabled; mini-backend runtime built at ${path.relative(
        rootDir,
        distDir,
      )} but excluded from the Tauri installer.`,
    );
    return null;
  }

  return stageTauriSidecar(distDir);
};

const buildFrontend = () => {
  fs.rmSync(path.join(rootDir, "dist"), { recursive: true, force: true });
  run("bun run build:react", "renderer build", { timeout: 900_000 });
};

const hardenFrontend = () => {
  const frontendHardenArgs = [];
  if (skipObfuscator) frontendHardenArgs.push("--skip-obfuscation");
  if (keepSourcemaps) frontendHardenArgs.push("--keep-sourcemaps");
  run(
    `node --max-old-space-size=${heavyNodeHeapMb} scripts/harden-frontend.mjs ${frontendHardenArgs.join(" ")}`,
    "frontend hardening",
    { timeout: 1_800_000 },
  );
};

const resolveTauriBundles = () => {
  if (targetPlatform === "win") return ["msi", "nsis"];
  if (targetPlatform === "mac" || targetPlatform === "darwin") return ["dmg"];
  if (targetPlatform === "linux") return ["appimage", "deb"];
  return [];
};

const resolveCargoTargetDir = () => {
  if (process.env.CARGO_TARGET_DIR) return process.env.CARGO_TARGET_DIR;
  return path.join(rootDir, "src-tauri", "target");
};

const resolveCargoReleaseDir = () => {
  const cargoTargetDir = resolveCargoTargetDir();
  return explicitTargetTriple
    ? path.join(cargoTargetDir, explicitTargetTriple, "release")
    : path.join(cargoTargetDir, "release");
};

const hasWindowsSigningConfig = () =>
  Boolean(
    process.env.KOMA_WINDOWS_CERT_THUMBPRINT ||
    process.env.WINDOWS_CERTIFICATE_THUMBPRINT ||
    process.env.CSC_LINK,
  );

const shouldSkipWindowsSigning = () =>
  (targetPlatform === "win" || process.platform === "win32") && !hasWindowsSigningConfig();

const signWindowsArtifact = (artifactPath, label) => {
  if (targetPlatform !== "win" && process.platform !== "win32") return;
  if (shouldSkipWindowsSigning()) return;
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Windows ${label} artifact not found at ${artifactPath}`);
  }

  run(
    `powershell -NoProfile -ExecutionPolicy Bypass -File ${quote(
      path.join(rootDir, "scripts", "sign-windows.ps1"),
    )} ${quote(artifactPath)}`,
    `windows signing for ${label}`,
    {
      timeout: 300_000,
      env: resolveTauriEnv(),
    },
  );
};

const mergeWindowsBundleConfig = (config, values) => {
  config.bundle = {
    ...config.bundle,
    windows: {
      ...config.bundle?.windows,
      ...values,
    },
  };
};

const resolveWindowsBundleVersion = () => {
  const config = JSON.parse(fs.readFileSync(path.join(rootDir, "src-tauri", "tauri.conf.json"), "utf8"));
  const version = String(config.version || "0.0.0");
  const [core, prerelease] = version.split("-", 2);
  if (!prerelease || /^\d+(?:\.\d+)*$/.test(prerelease)) {
    return version;
  }
  return `${core}-0`;
};

const resolveHardenedTauriConfigJson = () => {
  const config = {
    build: {
      beforeBuildCommand: null,
    },
  };

  if (targetPlatform === "win" || process.platform === "win32") {
    config.productName = "KOMA Studio";
    config.version = resolveWindowsBundleVersion();
    config.bundle = {
      copyright: "Copyright KOMA Studio",
    };
  }

  if (embedMiniBackend) {
    config.bundle = {
      ...config.bundle,
      resources: ["bin/_internal"],
      externalBin: ["bin/mini-backend"],
    };
  } else if (targetPlatform === "win" || process.platform === "win32") {
    mergeWindowsBundleConfig(config, {
      webviewInstallMode: {
        type: "downloadBootstrapper",
        silent: true,
      },
    });
  }

  if (shouldSkipWindowsSigning()) {
    mergeWindowsBundleConfig(config, {
      signCommand: null,
      digestAlgorithm: null,
      timestampUrl: null,
    });
  }

  return JSON.stringify(config);
};

const resolveHardenedTauriConfig = () => quote(resolveHardenedTauriConfigJson());

const resolveTauriEnv = () => {
  const env = {
    KOMA_EMBEDDED_MINI_BACKEND: embedMiniBackend ? "1" : "0",
  };
  const keyPath = path.join(os.homedir(), ".tauri", "koma-studio.key");

  if (!process.env.TAURI_SIGNING_PRIVATE_KEY && fs.existsSync(keyPath)) {
    env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(keyPath, "utf8").trim();
  }

  if (shouldSkipWindowsSigning()) {
    env.KOMA_CODESIGN_SKIP = "1";
  }

  const cargoTargetDir = resolveCargoTargetDir();
  if (!process.env.CARGO_TARGET_DIR && cargoTargetDir !== path.join(rootDir, "src-tauri", "target")) {
    env.CARGO_TARGET_DIR = cargoTargetDir;
  }

  return env;
};

const runTauriBuild = () => {
  const bundles = resolveTauriBundles();
  const buildArgs = ["--ci"];
  if (explicitTargetTriple) buildArgs.push("--target", explicitTargetTriple);
  if (bundles.length > 0) buildArgs.push("--bundles", ...bundles);
  buildArgs.push("--config", resolveHardenedTauriConfig());

  run(`bun run tauri build ${buildArgs.join(" ")}`, "tauri build", {
    timeout: 3_600_000,
    env: resolveTauriEnv(),
  });
  signWindowsArtifact(path.join(resolveCargoReleaseDir(), "koma-studio-v2.exe"), "tauri app executable");
};

const buildRustHelperBinaries = () => {
  const cargoArgs = [
    "build",
    "--release",
    "--manifest-path",
    quote(path.join(rootDir, "src-tauri", "Cargo.toml")),
    "--bin",
    "make_bsdiff",
    "--features",
    "updater-tools",
  ];
  if (explicitTargetTriple) cargoArgs.push("--target", explicitTargetTriple);

  run(`cargo ${cargoArgs.join(" ")}`, "rust helper binaries", {
    timeout: 900_000,
    env: {
      ...resolveTauriEnv(),
      TAURI_CONFIG: resolveHardenedTauriConfigJson(),
    },
  });
};

const hasSourceMaps = (dir) => {
  if (!fs.existsSync(dir)) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && hasSourceMaps(fullPath)) return true;
    if (entry.isFile() && entry.name.endsWith(".map")) return true;
  }
  return false;
};

const hasObfuscationMarkers = (dir) => {
  if (!fs.existsSync(dir)) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && hasObfuscationMarkers(fullPath)) return true;
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    if (/_0x[a-f0-9]{4,}/i.test(content) || /String\.fromCharCode|atob\(/.test(content)) {
      return true;
    }
  }
  return false;
};

const verify = ({ sidecar, buildProfile }) => {
  const distDir = path.join(rootDir, "dist");
  const config = JSON.parse(fs.readFileSync(path.join(rootDir, "src-tauri", "tauri.conf.json"), "utf8"));
  const csp = config.app?.security?.csp || "";
  const sidecarPayloadBytes = sizeOfPathBytes(resolveSidecarDir());
  const checks = [
    { name: "dist exists", ok: fs.existsSync(distDir) },
    { name: "source maps removed", ok: keepSourcemaps || !hasSourceMaps(distDir) },
    { name: "integrity manifest", ok: fs.existsSync(path.join(distDir, ".integrity.json")) },
    { name: "strict script-src", ok: csp.includes("script-src 'self'") && !csp.includes("'unsafe-eval'") },
    { name: "frontend obfuscation marker", ok: skipObfuscator || hasObfuscationMarkers(path.join(distDir, "assets")) },
    { name: "tauri updater public key", ok: Boolean(config.plugins?.updater?.pubkey) },
    { name: "tauri updater artifacts enabled", ok: config.bundle?.createUpdaterArtifacts === true },
    {
      name: embedMiniBackend ? "tauri sidecar binary" : "thin runtime excludes bundled sidecar",
      ok: embedMiniBackend
        ? skipMini || Boolean(sidecar && fs.existsSync(sidecar.targetBinary))
        : sidecarPayloadBytes === 0,
    },
  ];

  if (!skipMini) {
    // Assert the produced sidecar is stamped with the profile that was asked
    // for. This is the check that catches the failure this feature exists to
    // prevent: shipping a CPU binary to someone who selected CUDA.
    const manifestPath = path.join(rootDir, "..", "..", "packages", "mini-backend", "dist", PROFILE_MANIFEST_NAME);
    let stampedProfile = null;
    if (fs.existsSync(manifestPath)) {
      try {
        stampedProfile = JSON.parse(fs.readFileSync(manifestPath, "utf8")).profile ?? null;
      } catch {
        stampedProfile = null;
      }
    }
    checks.push({
      name: `sidecar built for profile "${buildProfile}"`,
      ok: stampedProfile === buildProfile,
    });
  }

  if (!skipTauri) {
    checks.push({
      name: "tauri bundle output",
      ok:
        fs.existsSync(path.join(resolveCargoReleaseDir(), "bundle")) ||
        fs.existsSync(path.join(rootDir, "src-tauri", "target", "release", "bundle")),
    });
  }

  console.log("\nVerification results:");
  for (const check of checks) {
    console.log(`  ${check.ok ? "[PASS]" : "[FAIL]"} ${check.name}`);
  }

  if (checks.some((check) => !check.ok)) {
    throw new Error("Hardened release verification failed");
  }
};

log("Starting V2 hardened Tauri release pipeline");
log(
  embedMiniBackend
    ? "Embedding mini-backend runtime in the installer (--embed-mini-backend)."
    : "Using thin runtime packaging; downloadable runtime artifacts are verified at app startup.",
);

// Step 0 runs before anything expensive: the profile decides which wheels get
// installed, so asking after a 40-minute Cython pass would be useless. It is
// skipped with --skip-mini, where no sidecar is produced at all and there is
// nothing for a profile to apply to.
let buildProfile = null;
if (!skipMini) {
  const selection = await resolveHardwareProfile({
    platformKey: targetPlatform,
    cliProfile: explicitProfile,
  });
  buildProfile = selection.profile;
  log(`Hardware profile: "${buildProfile}" (from ${selection.source})`);
  log("This profile's dependencies replace the CPU set; one sidecar is produced.");
}

let sidecar = null;
if (!skipMini) {
  logStep(1, "Harden and build mini-backend sidecar");
  sidecar = buildHardenedMiniBackend(buildProfile);
} else {
  logStep(1, "Skipping mini-backend (--skip-mini)");
  if (!embedMiniBackend) {
    cleanTauriSidecarStage();
  }
}

logStep(2, "Build React renderer");
buildFrontend();

logStep(3, "Harden renderer bundles");
hardenFrontend();

if (!skipTauri) {
  logStep(4, "Build signed Tauri bundles");
  buildRustHelperBinaries();
  runTauriBuild();
} else {
  logStep(4, "Skipping Tauri bundle (--skip-tauri)");
}

logStep(5, "Verify hardening outputs");
verify({ sidecar, buildProfile });

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
log(`Hardened release pipeline complete in ${elapsed}s`);
if (buildProfile) log(`Sidecar hardware profile: "${buildProfile}"`);