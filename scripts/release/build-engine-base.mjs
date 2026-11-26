import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ENGINE_ABI_VERSION, buildBackendOverlay } from "./build-backend-overlay.mjs";
import { computeContentTreeHash } from "./hash-tree.mjs";
import { extractTarZst, packShardedTarZst } from "./tar-zst.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MINI_BACKEND_DIR = path.join(REPO_ROOT, "packages", "mini-backend");

export const ENGINE_PART_BUDGET_BYTES = Math.floor(1.85 * 1024 * 1024 * 1024);

export const PROFILES_BY_PLATFORM = Object.freeze({
  win32: ["cpu", "windows-directml", "intel-openvino", "nvidia-cuda", "nvidia-cuda-legacy"],
  linux: ["cpu", "intel-openvino", "nvidia-cuda"],
  darwin: ["cpu", "apple-mps"],
});

const RELOCATABLE_PYTHON_VERSION = "3.12";

const resolveUvExecutable = () => {
  const probe = spawnSync("uv", ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
  if (probe.status !== 0) {
    throw new Error("`uv` executable is required on PATH to build Layer-1 runtime engines.");
  }
  return "uv";
};

const resolvePythonEntryRelative = (platform = process.platform) =>
  platform === "win32" ? "python.exe" : "bin/python3.12";

const runChecked = (cmd, args, { cwd = REPO_ROOT, env = process.env } = {}) => {
  const result = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(" ")}`);
  }
};

export const computeEngineInputHash = (profile, miniBackendDir = MINI_BACKEND_DIR) => {
  const targets = [
    path.join(miniBackendDir, "scripts", "ensure-mini-deps.py"),
    path.join(miniBackendDir, "mini_backend_tools"),
  ];
  for (const entry of fs.readdirSync(miniBackendDir, { withFileTypes: true })) {
    if (entry.isFile() && /^requirements.*\.txt$/.test(entry.name)) {
      targets.push(path.join(miniBackendDir, entry.name));
    }
  }
  const treeHash = computeContentTreeHash(targets, {
    baseDir: miniBackendDir,
    excludeTests: true,
  });
  return createHash("sha256")
    .update(`${ENGINE_ABI_VERSION}:${profile}:${process.platform}:${process.arch}:${treeHash}`)
    .digest("hex")
    .slice(0, 16);
};

export const pruneEngineBloat = (engineRoot) => {
  let removedBytes = 0;
  let removedFiles = 0;

  const removeTree = (targetPath) => {
    if (!fs.existsSync(targetPath)) return;
    const stat = fs.lstatSync(targetPath);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(targetPath)) {
        removeTree(path.join(targetPath, child));
      }
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      removedBytes += stat.size;
      removedFiles += 1;
      fs.rmSync(targetPath, { force: true });
    }
  };

  const sitePackages = process.platform === "win32"
    ? path.join(engineRoot, "Lib", "site-packages")
    : path.join(engineRoot, "lib", "python3.12", "site-packages");

  if (!fs.existsSync(sitePackages)) {
    return { removedBytes, removedFiles };
  }

  for (const entry of fs.readdirSync(sitePackages, { withFileTypes: true })) {
    const abs = path.join(sitePackages, entry.name);
    if (
      entry.name === "pip" ||
      entry.name.startsWith("pip-") ||
      entry.name === "setuptools" ||
      entry.name.startsWith("setuptools-") ||
      entry.name === "wheel" ||
      entry.name.startsWith("wheel-") ||
      entry.name === "PyInstaller" ||
      entry.name.startsWith("pyinstaller")
    ) {
      removeTree(abs);
    }
  }

  for (const pkg of ["torch", "scipy", "numpy", "cv2", "PIL"]) {
    for (const sub of ["test", "tests", "include"]) {
      const candidate = path.join(sitePackages, pkg, sub);
      if (fs.existsSync(candidate)) {
        removeTree(candidate);
      }
    }
  }

  const walkPrune = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__pycache__") {
          removeTree(abs);
          continue;
        }
        const relPosix = path.relative(sitePackages, abs).replaceAll("\\", "/");
        if (
          (relPosix.startsWith("nvidia/") || relPosix.startsWith("triton/")) &&
          (entry.name === "include" || entry.name === "lib")
        ) {
          removeTree(abs);
          continue;
        }
        walkPrune(abs);
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".lib") || entry.name.endsWith(".a") || entry.name.endsWith(".pdb")) {
          removeTree(abs);
        }
      }
    }
  };

  walkPrune(sitePackages);
  return { removedBytes, removedFiles };
};

const installStandalonePython = (stageEngineDir, pythonCacheDir) => {
  const uv = resolveUvExecutable();
  fs.mkdirSync(pythonCacheDir, { recursive: true });
  runChecked(uv, ["python", "install", RELOCATABLE_PYTHON_VERSION], {
    env: { ...process.env, UV_PYTHON_INSTALL_DIR: pythonCacheDir },
  });

  const findResult = spawnSync(uv, ["python", "find", RELOCATABLE_PYTHON_VERSION], {
    encoding: "utf8",
    env: { ...process.env, UV_PYTHON_INSTALL_DIR: pythonCacheDir, UV_PYTHON_PREFERENCE: "only-managed" },
  });
  if (findResult.status !== 0 || !findResult.stdout.trim()) {
    throw new Error(`uv python find failed: ${findResult.stderr}`);
  }
  const foundExe = findResult.stdout.trim().split(/\r?\n/)[0];
  const pythonInstallRoot = process.platform === "win32"
    ? path.dirname(foundExe)
    : path.dirname(path.dirname(foundExe));

  fs.rmSync(stageEngineDir, { recursive: true, force: true });
  fs.cpSync(pythonInstallRoot, stageEngineDir, { recursive: true, dereference: true });

  const cfgPath = path.join(stageEngineDir, "pyvenv.cfg");
  if (fs.existsSync(cfgPath)) {
    fs.rmSync(cfgPath, { force: true });
  }
  return path.join(stageEngineDir, resolvePythonEntryRelative());
};

const smokeRelocatedEngine = async ({
  parts,
  overlayArchivePath,
  pythonEntry,
}) => {
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "koma-engine-smoke-"));
  const relocatedEngineDir = path.join(smokeRoot, "engine-relocated");
  const overlayDir = path.join(smokeRoot, "overlay");
  try {
    for (const part of parts) {
      extractTarZst(part.path, relocatedEngineDir);
    }
    extractTarZst(overlayArchivePath, overlayDir);

    const pythonBin = path.join(relocatedEngineDir, pythonEntry);
    if (!fs.existsSync(pythonBin)) {
      throw new Error(`Relocated engine missing python entry: ${pythonBin}`);
    }

    const port = 18800 + Math.floor(Math.random() * 90);
    const child = spawn(pythonBin, ["-s", "-B", path.join(overlayDir, "app.py")], {
      cwd: overlayDir,
      env: {
        ...process.env,
        PORT: String(port),
        PYTHONNOUSERSITE: "1",
        PYTHONPATH: overlayDir,
        MINI_BACKEND_WARMUP_DETECTOR: "0",
        KOMA_LOCAL_API_SESSION_SECRET: "smoke-test-secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    try {
      const deadline = Date.now() + 90_000;
      let ok = false;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(`Relocated engine exited prematurely (${child.exitCode}): ${stderr}`);
        }
        try {
          const res = await fetch(`http://127.0.0.1:${port}/health`, {
            signal: AbortSignal.timeout(2_000),
          });
          if (res.ok) {
            ok = true;
            break;
          }
        } catch {
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!ok) {
        throw new Error(`Relocated engine /health timeout on port ${port}: ${stderr}`);
      }
    } finally {
      child.kill("SIGKILL");
    }
  } finally {
    fs.rmSync(smokeRoot, { recursive: true, force: true });
  }
};

export const buildEngineProfiles = async ({
  profiles = PROFILES_BY_PLATFORM[process.platform] ?? ["cpu"],
  engineVersion,
  outputDir = path.join(REPO_ROOT, "release-artifacts", "engine"),
  skipSmoke = false,
} = {}) => {
  if (!engineVersion) {
    throw new Error("--engine-version is required (e.g. 1.0.0)");
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const overlayBuild = await buildBackendOverlay({ outputDir });
  const pythonCacheDir = path.join(os.tmpdir(), "koma-uv-python-cache");
  const environmentFingerprint = `${process.platform}-${process.arch}-py${RELOCATABLE_PYTHON_VERSION}-${ENGINE_ABI_VERSION}`;

  const manifestProfiles = {};

  for (const profile of profiles) {
    const contentHash = computeEngineInputHash(profile);
    const baseName = `koma-engine-${ENGINE_ABI_VERSION}-${profile}-${engineVersion}-${process.platform}-${process.arch}`;
    const ledgerPath = path.join(outputDir, `${baseName}.engine-ledger.json`);

    if (fs.existsSync(ledgerPath)) {
      const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
      const allPresent =
        ledger.contentHash === contentHash &&
        ledger.environmentFingerprint === environmentFingerprint &&
        Array.isArray(ledger.parts) &&
        ledger.parts.every((part) => fs.existsSync(path.join(outputDir, part.file)));

      if (allPresent) {
        console.log(`[release:engine] CACHE HIT profile=${profile} (${ledger.parts.length} part(s))`);
        manifestProfiles[profile] = {
          profile,
          engineAbi: ENGINE_ABI_VERSION,
          engineVersion,
          platform: process.platform,
          arch: process.arch,
          pythonEntry: resolvePythonEntryRelative(),
          parts: ledger.parts,
        };
        continue;
      }
    }

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `koma-engine-work-${profile}-`));
    const stageEngineDir = path.join(workDir, "engine");
    try {
      const pythonBin = installStandalonePython(stageEngineDir, pythonCacheDir);
      runChecked(
        "uv",
        [
          "pip",
          "install",
          "--system",
          "--break-system-packages",
          "--python",
          pythonBin,
          "filelock",
          "packaging",
          "pydantic",
        ],
      );
      runChecked(
        pythonBin,
        [path.join(MINI_BACKEND_DIR, "scripts", "ensure-mini-deps.py")],
        {
          env: {
            ...process.env,
            MINI_BACKEND_ACCELERATION_PROFILE: profile,
            KOMA_STANDALONE_PYTHON: "1",
          },
        },
      );

      const pruned = pruneEngineBloat(stageEngineDir);
      console.log(
        `[release:engine] pruned ${pruned.removedFiles} bloat file(s) (${(pruned.removedBytes / (1024 * 1024)).toFixed(1)} MB) for ${profile}`,
      );

      const engineManifest = {
        schemaVersion: 3,
        engineAbi: ENGINE_ABI_VERSION,
        engineVersion,
        profile,
        platform: process.platform,
        arch: process.arch,
        pythonEntry: resolvePythonEntryRelative(),
      };
      fs.writeFileSync(
        path.join(stageEngineDir, "engine-manifest.json"),
        `${JSON.stringify(engineManifest, null, 2)}\n`,
        "utf8",
      );

      const parts = await packShardedTarZst({
        sourceDir: stageEngineDir,
        outputDir,
        baseName,
        budgetBytes: ENGINE_PART_BUDGET_BYTES,
        level: 14,
        deduplicateHardlinks: true,
      });

      if (!skipSmoke) {
        await smokeRelocatedEngine({
          parts,
          overlayArchivePath: overlayBuild.archivePath,
          pythonEntry: resolvePythonEntryRelative(),
        });
      }

      const tag = `runtime-engine-${ENGINE_ABI_VERSION}-${engineVersion}`;
      const manifestParts = parts.map((part) => ({
        file: part.file,
        url: `https://github.com/klaus-2/koma-studio/releases/download/${tag}/${part.file}`,
        sha256: part.sha256,
        sha512: part.sha512,
        size: part.sizeBytes,
      }));

      fs.writeFileSync(
        ledgerPath,
        `${JSON.stringify(
          {
            schemaVersion: 3,
            contentHash,
            environmentFingerprint,
            engineVersion,
            parts: manifestParts,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      manifestProfiles[profile] = {
        profile,
        engineAbi: ENGINE_ABI_VERSION,
        engineVersion,
        platform: process.platform,
        arch: process.arch,
        pythonEntry: resolvePythonEntryRelative(),
        parts: manifestParts,
      };
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }

  const runtimeManifest = {
    schemaVersion: 3,
    engineAbi: ENGINE_ABI_VERSION,
    engineVersion,
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    defaultProfile: "cpu",
    overlay: {
      overlayHash: overlayBuild.metadata.overlayHash,
      appVersion: overlayBuild.metadata.appVersion,
      file: overlayBuild.metadata.file,
      url: `https://github.com/klaus-2/koma-studio/releases/download/v${overlayBuild.metadata.appVersion}/${overlayBuild.metadata.file}`,
      sha256: overlayBuild.metadata.sha256,
      sha512: overlayBuild.metadata.sha512,
      size: overlayBuild.metadata.size,
      entry: "app.py",
      requiredFiles: overlayBuild.metadata.requiredFiles,
    },
    profiles: manifestProfiles,
  };

  const manifestName = `koma-runtime-${process.platform}-${process.arch}.json`;
  const manifestPath = path.join(outputDir, manifestName);
  fs.writeFileSync(manifestPath, `${JSON.stringify(runtimeManifest, null, 2)}\n`, "utf8");
  return { manifestPath, runtimeManifest, overlayBuild };
};

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const args = process.argv.slice(2);
  let engineVersion = "";
  let profiles = (process.env.KOMA_ENGINE_PROFILES || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  let outputDir = path.join(REPO_ROOT, "release-artifacts", "engine");
  let skipSmoke = false;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--engine-version" && args[i + 1]) {
      engineVersion = args[++i];
    } else if (args[i] === "--profiles" && args[i + 1]) {
      profiles = args[++i].split(",").map((item) => item.trim()).filter(Boolean);
    } else if (args[i] === "--out" && args[i + 1]) {
      outputDir = path.resolve(args[++i]);
    } else if (args[i] === "--skip-smoke") {
      skipSmoke = true;
    }
  }

  const resolvedProfiles = profiles.length > 0 ? profiles : (PROFILES_BY_PLATFORM[process.platform] ?? ["cpu"]);
  const built = await buildEngineProfiles({
    profiles: resolvedProfiles,
    engineVersion,
    outputDir,
    skipSmoke,
  });
  console.log(`[release:engine] wrote manifest ${built.manifestPath}`);
}
