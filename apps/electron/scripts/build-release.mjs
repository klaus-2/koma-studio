import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  shouldSkipElectronTypecheck,
  shouldSkipMiniBackendBuild,
} from "./build-incremental-cache.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const normalizeEnvValue = (value) => (typeof value === "string" ? value.trim() : "");
const shouldIncludeZip = !["0", "false", "no"].includes(
  normalizeEnvValue(process.env.RELEASE_INCLUDE_ZIP).toLowerCase(),
);
const shouldKeepWinUnpacked = ["1", "true", "yes"].includes(
  normalizeEnvValue(process.env.RELEASE_KEEP_WIN_UNPACKED).toLowerCase(),
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async (
  command,
  label,
  {
    retries = 0,
    retryDelayMs = 1200,
  } = {},
) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      execSync(command, {
        stdio: "inherit",
        env: process.env,
        shell: true,
      });
      return;
    } catch {
      const shouldRetry = attempt < retries;
      if (shouldRetry) {
        const nextAttempt = attempt + 2;
        console.warn(
          `[release] ${label} failed, retrying (${nextAttempt}/${retries + 1})...`,
        );
        await sleep(retryDelayMs);
        continue;
      }

      throw new Error(`${label} failed`);
    }
  }
};

const shouldSkipMiniBackend = () => {
  const decision = shouldSkipMiniBackendBuild(rootDir);
  if (decision.reason === "missing-venv") {
    console.log("[release:skip-check] build:mini: venv not found, will build");
    return false;
  }
  if (decision.reason === "missing-executable") {
    console.log("[release:skip-check] build:mini: dist exe not found, will build");
    return false;
  }
  if (decision.skip) {
    console.log("[release:skip-check] build:mini: CACHE HIT — sources unchanged, skipping");
    return true;
  }

  console.log("[release:skip-check] build:mini: CACHE MISS — sources changed, will build");
  return false;
};

const shouldSkipTypeScript = () => {
  const decision = shouldSkipElectronTypecheck(rootDir);
  if (decision.reason === "missing-outputs") {
    console.log("[release:skip-check] build:electron: dist-electron not found, will build");
    return false;
  }
  if (decision.skip) {
    console.log("[release:skip-check] build:electron: CACHE HIT — TS sources unchanged, skipping tsc");
    return true;
  }

  console.log("[release:skip-check] build:electron: CACHE MISS — TS sources changed, will build");
  return false;
};

const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const releaseOutputDir = `release-desktop/build-${timestamp}`;

const main = async () => {
  console.log(`[release] output dir: ${releaseOutputDir}`);

  const cscLink = normalizeEnvValue(process.env.CSC_LINK);
  const cscKeyPassword = normalizeEnvValue(process.env.CSC_KEY_PASSWORD);
  const signingConfigured = cscLink.length > 0 && cscKeyPassword.length > 0;

  if (signingConfigured) {
    console.log("[release] code signing: enabled");
  } else {
    console.warn(
      "[release] code signing env not found (CSC_LINK/CSC_KEY_PASSWORD). Building unsigned local artifact.",
    );
  }

  // Optimization 3: Skip build:mini if venv+dist exist and sources unchanged
  if (!shouldSkipMiniBackend()) {
    await run("bun run build:mini", "build:mini");
  } else {
    console.log("[release] build:mini skipped (cached)");
  }

  // Optimization 2: Vite cacheDir — Vite uses node_modules/.vite by default.
  // Only clean the output dirs (dist, dist-electron), preserve Vite's cache.
  const distDir = path.join(rootDir, "dist");
  const distElectronDir = path.join(rootDir, "dist-electron");
  fs.rmSync(distDir, { recursive: true, force: true });
  // Only clean dist-electron if we're going to rebuild TypeScript
  if (!shouldSkipTypeScript()) {
    fs.rmSync(distElectronDir, { recursive: true, force: true });
  }

  await run("bun run build:react", "build:react", {
    retries: 2,
    retryDelayMs: 1500,
  });

  // Optimization 5: Skip TypeScript compilation if sources unchanged,
  // but always run cert pin refresh and runtime config write.
  if (!shouldSkipTypeScript()) {
    await run("bun run build:electron", "build:electron");
  } else {
    console.log("[release] build:electron typecheck skipped (cached), refreshing runtime config...");
    await run("node scripts/build-electron.mjs --skip-typecheck", "build:electron:skip-typecheck");
  }

  const electronBuilderArgs = [`--config.directories.output=${releaseOutputDir}`];
  if (!signingConfigured) {
    electronBuilderArgs.push("--config.forceCodeSigning=false");
  }

  const platformArgs = normalizeEnvValue(process.env.ELECTRON_BUILDER_PLATFORM_ARGS);
  if (platformArgs) {
    electronBuilderArgs.push(platformArgs);
  }
  const targetsWindows = !platformArgs || /(^|\s)--win(\s|$)/.test(platformArgs);
  if (targetsWindows && !shouldIncludeZip) {
    electronBuilderArgs.push("-c.win.target=nsis-web");
  }

  await run("node scripts/ensure-windows-icon.mjs", "ensure-windows-icon");
  await run(`npx electron-builder ${electronBuilderArgs.join(" ")}`, "electron-builder");
  await run(`node scripts/create-portable-dir.mjs ${releaseOutputDir}`, "create-portable-dir");
  await run(`node scripts/build-mini-backend-artifacts.mjs ${releaseOutputDir}`, "build-mini-backend-artifacts");
  await run(`node scripts/verify-release.mjs ${releaseOutputDir}`, "verify-release");
  if (!shouldKeepWinUnpacked) {
    fs.rmSync(path.join(rootDir, releaseOutputDir, "win-unpacked"), { recursive: true, force: true });
  }
  await run("node scripts/cleanup-build-caches.mjs", "cleanup-build-caches");
  console.log("[release] completed successfully");
};

main().catch((error) => {
  console.error(`[release] error: ${error.message}`);
  process.exit(1);
});
