/**
 * build-hardened-release.mjs
 * ==========================
 * Orchestrates a full hardened release build with all anti-reverse-engineering
 * protections applied. This is the single entry point for creating a
 * production-ready, protected build.
 *
 * Pipeline:
 *   1. Build mini-backend (PyInstaller) with Cython + PyArmor hardening
 *   2. Build React frontend (Vite production)
 *   3. Harden frontend (obfuscation, SRI, source map removal)
 *   4. Build Electron main/preload (TypeScript compilation)
 *   5. Harden Electron (V8 bytecode + obfuscation)
 *   6. Package with electron-builder (ASAR + code signing + fuses)
 *   7. Post-build verification
 *
 * Usage:
 *   node scripts/build-hardened-release.mjs [options]
 *
 * Options:
 *   --skip-mini          Skip mini-backend build
 *   --skip-cython        Skip Cython compilation for mini-backend
 *   --skip-pyarmor       Skip PyArmor obfuscation for mini-backend
 *   --skip-bytenode      Skip V8 bytecode compilation for Electron
 *   --skip-obfuscator    Skip JavaScript obfuscation
 *   --platform <win|mac|linux>  Target platform (default: current)
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  shouldSkipElectronTypecheck,
  shouldSkipHardenedMiniBackendBuild,
  writeHardenedMiniBackendCache,
} from "./build-incremental-cache.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const skipMini = args.includes("--skip-mini");
const skipCython = args.includes("--skip-cython");
const skipPyarmor = args.includes("--skip-pyarmor");
const skipBytenode = args.includes("--skip-bytenode");
const skipObfuscator = args.includes("--skip-obfuscator");
const shouldIncludeZip = !["0", "false", "no"].includes(
  String(process.env.RELEASE_INCLUDE_ZIP || "").trim().toLowerCase(),
);
const shouldKeepWinUnpacked = ["1", "true", "yes"].includes(
  String(process.env.RELEASE_KEEP_WIN_UNPACKED || "").trim().toLowerCase(),
);

const platformIdx = args.indexOf("--platform");
const targetPlatform = platformIdx >= 0 ? args[platformIdx + 1] : null;
const heavyNodeHeapMb = process.env.HARDEN_NODE_MAX_OLD_SPACE_SIZE || "8192";

const log = (msg) => console.log(`\n${"=".repeat(60)}\n[hardened-release] ${msg}\n${"=".repeat(60)}`);
const logStep = (step, total, msg) =>
  console.log(`\n[${"=".repeat(3)}] Step ${step}/${total}: ${msg}`);

const run = (command, label, { retries = 0, delaySec = 2, cwd = rootDir, timeout = 600_000, env = {} } = {}) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`  $ ${command}`);
      execSync(command, {
        cwd,
        stdio: "inherit",
        env: {
          ...process.env,
          ...env,
        },
        shell: true,
        timeout,
      });
      return;
    } catch (err) {
      if (attempt < retries) {
        console.log(`  Retry ${attempt + 1}/${retries} after ${delaySec}s...`);
        execSync(`node -e "setTimeout(()=>{},${delaySec * 1000})"`, { stdio: "pipe" });
      } else {
        throw new Error(`${label} failed after ${attempt + 1} attempt(s)`);
      }
    }
  }
};

const resolveMiniVenvPython = () => {
  const venvName = process.env.MINI_BACKEND_VENV_NAME || ".venv-mini";
  const base = path.isAbsolute(venvName) ? venvName : path.join(rootDir, venvName);
  return process.platform === "win32"
    ? path.join(base, "Scripts", "python.exe")
    : path.join(base, "bin", "python");
};

const totalSteps = 8;
const startTime = Date.now();

// -------------------------------------------------------------------------
// Step 1: Hardened Mini-Backend Build
// -------------------------------------------------------------------------
if (!skipMini) {
  logStep(1, totalSteps, "Building hardened mini-backend");

  const hardenedMiniDecision = shouldSkipHardenedMiniBackendBuild(rootDir, {
    skipCython,
    skipPyarmor,
  });
  if (hardenedMiniDecision.skip) {
    console.log("  Hardened mini-backend cache hit; reusing existing mini-backend/dist");
  } else {

  const hardenArgs = [];
  if (skipCython) hardenArgs.push("--skip-cython");
  if (skipPyarmor) hardenArgs.push("--skip-pyarmor");

  const python = resolveMiniVenvPython();

  // Ensure venv and deps
  run("bun run mini:install-deps", "mini:install-deps");

  // Install hardening dependencies
  run(`"${python}" -m pip install cython pyarmor --quiet`, "install-hardening-deps");

  // Run hardening (creates mini-backend-hardened/)
  run(
    `"${python}" scripts/harden-mini-backend.py ${hardenArgs.join(" ")}`,
    "harden-mini-backend",
  );

  // Build with PyInstaller from hardened source
  const hardenedDir = path.join(rootDir, "mini-backend-hardened");
  const distDir = path.join(hardenedDir, "dist");
  const buildDir = path.join(hardenedDir, "build");

  if (fs.existsSync(hardenedDir)) {
    run(
      `"${python}" -m PyInstaller -y --distpath "${distDir}" --workpath "${buildDir}" "${path.join(hardenedDir, "build.spec")}"`,
      "pyinstaller-hardened",
      { cwd: hardenedDir },
    );

    // Flatten onedir output
    const onedirSubdir = path.join(distDir, "mini-backend");
    if (fs.existsSync(onedirSubdir) && fs.statSync(onedirSubdir).isDirectory()) {
      for (const entry of fs.readdirSync(onedirSubdir)) {
        const src = path.join(onedirSubdir, entry);
        const dest = path.join(distDir, entry);
        // Use cpSync+rmSync instead of renameSync: renameSync fails with EPERM
        // when the dist directory is a Windows junction point.
        fs.cpSync(src, dest, { recursive: true });
        fs.rmSync(src, { recursive: true, force: true });
      }
      fs.rmSync(onedirSubdir, { recursive: true, force: true });
    }

    // Copy hardened dist to standard mini-backend/dist location
    const standardDist = path.join(rootDir, "mini-backend", "dist");
    fs.rmSync(standardDist, { recursive: true, force: true });
    fs.cpSync(distDir, standardDist, { recursive: true });

    // Write launch manifest
    run("node scripts/build-mini-backend.mjs", "write-launch-manifest");

    const { cacheDir } = writeHardenedMiniBackendCache(rootDir, {
      skipCython,
      skipPyarmor,
    });
    console.log(`  Hardened mini-backend cache updated at ${cacheDir}`);

    console.log("  Hardened mini-backend built successfully");
  } else {
    console.log("  WARN: Hardened directory not found, falling back to standard build");
    run("bun run build:mini", "build:mini");
  }
  }
} else {
  logStep(1, totalSteps, "Skipping mini-backend build (--skip-mini)");
}

// -------------------------------------------------------------------------
// Step 2: Build React Frontend
// -------------------------------------------------------------------------
logStep(2, totalSteps, "Building React frontend (Vite production)");
const distFrontend = path.join(rootDir, "dist");
const distElectron = path.join(rootDir, "dist-electron");
fs.rmSync(distFrontend, { recursive: true, force: true });
fs.rmSync(distElectron, { recursive: true, force: true });

run("bun run build:react", "build:react", { retries: 1 });

// -------------------------------------------------------------------------
// Step 3: Harden Frontend
// -------------------------------------------------------------------------
logStep(3, totalSteps, "Hardening frontend bundles");
const frontendHardenArgs = [];
if (skipObfuscator) frontendHardenArgs.push("--skip-obfuscation");
run(
  `node --max-old-space-size=${heavyNodeHeapMb} scripts/harden-frontend.mjs ${frontendHardenArgs.join(" ")}`,
  "harden-frontend",
);

// -------------------------------------------------------------------------
// Step 4: Build Electron Main/Preload
// -------------------------------------------------------------------------
logStep(4, totalSteps, "Building Electron main/preload");
const electronTypecheckDecision = shouldSkipElectronTypecheck(rootDir);
if (electronTypecheckDecision.skip) {
  console.log("  Electron typecheck cache hit; skipping repeated TypeScript check");
  run("node scripts/build-electron.mjs --skip-typecheck", "build:electron:skip-typecheck");
} else {
  run("bun run build:electron", "build:electron");
}

// -------------------------------------------------------------------------
// Step 5: Harden Electron
// -------------------------------------------------------------------------
logStep(5, totalSteps, "Hardening Electron main process");
const electronHardenArgs = [];
if (skipBytenode) electronHardenArgs.push("--skip-bytenode");
if (skipObfuscator) electronHardenArgs.push("--skip-obfuscator");
run(
  `node --max-old-space-size=${heavyNodeHeapMb} scripts/harden-electron.mjs ${electronHardenArgs.join(" ")}`,
  "harden-electron",
);

// -------------------------------------------------------------------------
// Step 6: Package with electron-builder
// -------------------------------------------------------------------------
logStep(6, totalSteps, "Packaging with electron-builder");
run("node scripts/ensure-windows-icon.mjs", "ensure-windows-icon");

let platformArgs = "";
if (targetPlatform === "win") platformArgs = "--win";
else if (targetPlatform === "mac") platformArgs = "--mac";
else if (targetPlatform === "linux") platformArgs = "--linux";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outputDir = path.join(rootDir, "release-desktop", `hardened-${timestamp}`);

const cscAvailable =
  typeof process.env.CSC_LINK === "string" && process.env.CSC_LINK.trim().length > 0;
const signingFlag = cscAvailable ? "" : " --config.forceCodeSigning=false";
const targetsWindows = !platformArgs || /(^|\s)--win(\s|$)/.test(platformArgs);
const targetOverride = targetsWindows && !shouldIncludeZip ? " -c.win.target=nsis-web" : "";

run(
  `npx electron-builder ${platformArgs} --publish never -c.directories.output="${outputDir}"${signingFlag}${targetOverride}`,
  "electron-builder",
);

// -------------------------------------------------------------------------
// Step 7: Mini-backend profile artifacts
// -------------------------------------------------------------------------
if (!skipMini) {
  logStep(7, totalSteps, "Building mini-backend profile artifacts");
  const runtimeArtifactBuildOptions = {
    timeout: 3600_000,
    env: {
      MINI_BACKEND_ARTIFACTS_HARDENED: "1",
      MINI_BACKEND_HARDEN_SKIP_CYTHON: skipCython ? "1" : "0",
      MINI_BACKEND_HARDEN_SKIP_PYARMOR: skipPyarmor ? "1" : "0",
    },
  };
  run(
    `node scripts/build-mini-backend-artifacts.mjs "${outputDir}"`,
    "build-mini-backend-artifacts",
    runtimeArtifactBuildOptions,
  );
} else {
  logStep(7, 8, "Skipping mini-backend profile artifacts (--skip-mini)");
}

// -------------------------------------------------------------------------
// Step 8: Post-build verification
// -------------------------------------------------------------------------
logStep(8, 8, "Post-build verification");

const verifyItems = [];

// Check ASAR exists
const asarCandidates = [
  path.join(outputDir, "win-unpacked", "resources", "app.asar"),
  path.join(outputDir, "linux-unpacked", "resources", "app.asar"),
  path.join(outputDir, "mac", "KŌMA Studio.app", "Contents", "Resources", "app.asar"),
];
const asarFound = asarCandidates.some((p) => fs.existsSync(p));
verifyItems.push({ check: "ASAR package", ok: asarFound });

// Check no source maps leaked
let sourceMapsFound = false;
const walkForMaps = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walkForMaps(path.join(dir, entry.name));
    else if (entry.name.endsWith(".map")) sourceMapsFound = true;
  }
};
walkForMaps(distFrontend);
verifyItems.push({ check: "No source maps in dist/", ok: !sourceMapsFound });

// Check hardened files exist
const mainJs = path.join(distElectron, "main.js");
const preloadJs = path.join(distElectron, "preload.js");
verifyItems.push({ check: "main.js exists", ok: fs.existsSync(mainJs) });
verifyItems.push({ check: "preload.js exists", ok: fs.existsSync(preloadJs) });

// Check mini-backend artifacts
const miniArtifactsDir = path.join(outputDir, "mini-backend-artifacts");
const hasMiniArtifacts = fs.existsSync(miniArtifactsDir);
verifyItems.push({ check: "Mini-backend artifacts", ok: hasMiniArtifacts || skipMini });

if (!shouldKeepWinUnpacked) {
  fs.rmSync(path.join(outputDir, "win-unpacked"), { recursive: true, force: true });
}

// Report
console.log("\nVerification results:");
for (const item of verifyItems) {
  console.log(`  ${item.ok ? "[PASS]" : "[FAIL]"} ${item.check}`);
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const allPassed = verifyItems.every((v) => v.ok);

log(
  allPassed
    ? `Hardened release build complete! (${elapsed}s)\n  Output: ${outputDir}`
    : `Build completed with warnings (${elapsed}s)\n  Output: ${outputDir}`,
);
