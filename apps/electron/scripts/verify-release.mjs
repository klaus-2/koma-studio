import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const releaseDir = process.argv[2];

if (!releaseDir) {
  throw new Error("Usage: node scripts/verify-release.mjs <release-output-dir>");
}

const normalizedReleaseDir = path.resolve(releaseDir);
const resolveUnpackedResourcesDir = () => {
  if (process.platform === "darwin") {
    const macDir = path.join(normalizedReleaseDir, "mac");
    assertExists(macDir, "mac release directory");
    const appBundle = fs
      .readdirSync(macDir, { withFileTypes: true })
      .find((entry) => entry.isDirectory() && entry.name.endsWith(".app"));
    if (!appBundle) {
      throw new Error(`No .app bundle found in ${macDir}`);
    }
    return {
      unpackedDir: path.join(macDir, appBundle.name),
      resourcesDir: path.join(macDir, appBundle.name, "Contents", "Resources"),
    };
  }

  const unpackedDirName = process.platform === "linux" ? "linux-unpacked" : "win-unpacked";
  return {
    unpackedDir: path.join(normalizedReleaseDir, unpackedDirName),
    resourcesDir: path.join(normalizedReleaseDir, unpackedDirName, "resources"),
  };
};

const { unpackedDir, resourcesDir } = resolveUnpackedResourcesDir();
const asarPath = path.join(resourcesDir, "app.asar");
const miniBackendDir = path.join(resourcesDir, "mini-backend");
const manifestPath = path.join(miniBackendDir, "launch-manifest.json");

const assertExists = (targetPath, label) => {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
  }
};

const readManifest = () => {
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw);
};

const ensureAsarContains = (needle) => {
  const listing = execSync(`npx asar list "${asarPath}"`, {
    stdio: "pipe",
    encoding: "utf8",
    shell: true,
  });
  const normalizedListing = listing.replaceAll("\\", "/");
  if (!normalizedListing.includes(needle)) {
    throw new Error(`app.asar is missing required entry: ${needle}`);
  }
};

const waitForHealth = async (baseUrl) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(1_500),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // backend still booting
    }
    await delay(1_000);
  }
  throw new Error(`Packaged mini-backend did not respond healthy at ${baseUrl}`);
};

const terminateProcessTree = (pid) => {
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, {
        stdio: "ignore",
        shell: true,
      });
      return;
    } catch {
      // fall through
    }
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // no-op
  }
};

const main = async () => {
  assertExists(unpackedDir, "Unpacked release directory");
  assertExists(asarPath, "app.asar");
  assertExists(manifestPath, "launch manifest");

  ensureAsarContains("/dist-electron/main.js");
  ensureAsarContains("/dist-electron/preload.js");

  const manifest = readManifest();
  const defaultEntry = manifest.profiles?.[manifest.defaultProfile];
  if (!defaultEntry?.entry) {
    throw new Error("launch manifest missing default entry");
  }

  const backendExecutable = path.join(miniBackendDir, defaultEntry.entry);
  assertExists(backendExecutable, "Packaged mini-backend executable");

  const port = 18991;
  const localApiUrl = `http://127.0.0.1:${port}`;
  const child = spawn(backendExecutable, [], {
    cwd: miniBackendDir,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(port),
      KOMA_MODELS_ROOT: path.join(unpackedDir, "smoke-models"),
      KOMA_LOCAL_API_SESSION_SECRET: "smoke-secret",
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
      MINI_BACKEND_WARMUP_DETECTOR: "0",
      MINI_BACKEND_ACCELERATION_PROFILE:
        defaultEntry.env?.MINI_BACKEND_ACCELERATION_PROFILE ?? manifest.defaultProfile,
    },
  });

  try {
    await waitForHealth(localApiUrl);
  } finally {
    terminateProcessTree(child.pid);
  }

  console.log(`[verify-release] verified ${normalizedReleaseDir}`);
};

main().catch((error) => {
  console.error(`[verify-release] error: ${error.message}`);
  process.exit(1);
});
