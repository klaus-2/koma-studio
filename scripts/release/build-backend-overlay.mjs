import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectDeterministicFiles, computeContentTreeHash } from "./hash-tree.mjs";
import { hashFileSha256, hashFileSha512Base64, writeTarZst } from "./tar-zst.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const MINI_BACKEND_DIR = path.join(REPO_ROOT, "packages", "mini-backend");
export const TAURI_RESOURCES_DIR = path.join(REPO_ROOT, "apps", "tauri", "src-tauri", "resources");

export const ENGINE_ABI_VERSION = "v1";

const OVERLAY_DIRS = [
  "core",
  "mini_backend_tools",
  "models",
  "pipelines",
  "resources",
  "routers",
  "schemas",
  "services",
  "utils",
];

const OVERLAY_ROOT_FILES = [
  "app.py",
  "scripts/ensure-mini-deps.py",
];

const isExcludedOverlayFile = (relPosix) => {
  if (
    relPosix.endsWith(".onnx") ||
    relPosix.endsWith(".pt") ||
    relPosix.endsWith(".pth") ||
    relPosix.endsWith(".ckpt") ||
    relPosix.endsWith(".safetensors") ||
    relPosix.endsWith(".gguf")
  ) {
    return true;
  }
  if (relPosix.includes("/weights/")) {
    return true;
  }
  return false;
};

const readTauriAppVersion = (repoRoot = REPO_ROOT) => {
  const pkgPath = path.join(repoRoot, "apps", "tauri", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (typeof pkg.version !== "string" || !pkg.version.trim()) {
    throw new Error("apps/tauri/package.json version is missing");
  }
  return pkg.version.trim();
};

export const collectOverlayTargets = (miniBackendDir = MINI_BACKEND_DIR) => {
  const targets = [];
  for (const dir of OVERLAY_DIRS) {
    const abs = path.join(miniBackendDir, dir);
    if (fs.existsSync(abs)) {
      targets.push(abs);
    }
  }
  for (const rel of OVERLAY_ROOT_FILES) {
    const abs = path.join(miniBackendDir, rel);
    if (fs.existsSync(abs)) {
      targets.push(abs);
    }
  }
  for (const entry of fs.readdirSync(miniBackendDir, { withFileTypes: true })) {
    if (entry.isFile() && /^requirements.*\.txt$/.test(entry.name)) {
      targets.push(path.join(miniBackendDir, entry.name));
    }
  }
  return targets;
};

export const buildBackendOverlay = async ({
  repoRoot = REPO_ROOT,
  outputDir = path.join(repoRoot, "release-artifacts"),
  syncTauriResource = false,
  engineAbi = ENGINE_ABI_VERSION,
} = {}) => {
  const miniBackendDir = path.join(repoRoot, "packages", "mini-backend");
  const requiredRel = "models/manifests/model-assets.json";
  const requiredAbs = path.join(miniBackendDir, requiredRel);
  if (!fs.existsSync(requiredAbs)) {
    throw new Error(`Required backend data file missing: ${requiredAbs}`);
  }
  JSON.parse(fs.readFileSync(requiredAbs, "utf8"));

  const targets = collectOverlayTargets(miniBackendDir);
  const fullHash = computeContentTreeHash(targets, {
    baseDir: miniBackendDir,
    excludeTests: true,
  });
  const overlayHash = fullHash.slice(0, 16);
  const appVersion = readTauriAppVersion(repoRoot);

  const collectedFiles = [];
  const seen = new Set();
  for (const target of targets) {
    for (const file of collectDeterministicFiles(target, {
      baseDir: miniBackendDir,
      excludeTests: true,
    })) {
      if (seen.has(file.relPath) || isExcludedOverlayFile(file.relPath)) {
        continue;
      }
      seen.add(file.relPath);
      collectedFiles.push(file);
    }
  }
  collectedFiles.sort((left, right) => left.relPath.localeCompare(right.relPath));

  const overlayManifest = {
    schemaVersion: 3,
    overlayHash,
    contentSha256: fullHash,
    appVersion,
    engineAbi,
    generatedAt: new Date().toISOString(),
    entry: "app.py",
    requiredFiles: [requiredRel],
  };

  const manifestBuffer = Buffer.from(`${JSON.stringify(overlayManifest, null, 2)}\n`, "utf8");
  const tarEntries = [
    ...collectedFiles.map((file) => ({
      type: "file",
      tarPath: file.relPath,
      absPath: file.absPath,
      mode: file.isExecutable ? 0o755 : 0o644,
    })),
    {
      type: "file",
      tarPath: "overlay-manifest.json",
      data: manifestBuffer,
      mode: 0o644,
    },
  ];

  fs.mkdirSync(outputDir, { recursive: true });
  const archiveName = `koma-backend-overlay-${overlayHash}.tar.zst`;
  const archivePath = path.join(outputDir, archiveName);
  await writeTarZst(tarEntries, archivePath, { level: 16 });

  const sha256 = await hashFileSha256(archivePath);
  const sha512 = await hashFileSha512Base64(archivePath);
  const size = fs.statSync(archivePath).size;

  const metadata = {
    ...overlayManifest,
    file: archiveName,
    sha256,
    sha512,
    size,
    fileCount: collectedFiles.length,
  };

  const metaPath = path.join(outputDir, `koma-backend-overlay-${overlayHash}.json`);
  fs.writeFileSync(metaPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  if (syncTauriResource) {
    const tauriResDir = path.join(repoRoot, "apps", "tauri", "src-tauri", "resources");
    fs.mkdirSync(tauriResDir, { recursive: true });
    fs.copyFileSync(archivePath, path.join(tauriResDir, "koma-backend-overlay.tar.zst"));
    fs.writeFileSync(
      path.join(tauriResDir, "koma-backend-overlay.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8",
    );
  }

  return { archivePath, metaPath, metadata };
};

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const args = process.argv.slice(2);
  let outputDir = path.join(REPO_ROOT, "release-artifacts");
  let syncTauriResource = false;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out" && args[i + 1]) {
      outputDir = path.resolve(args[++i]);
    } else if (args[i] === "--sync-tauri-resource") {
      syncTauriResource = true;
    }
  }

  const result = await buildBackendOverlay({ outputDir, syncTauriResource });
  console.log(
    `[release:overlay] built ${result.metadata.file} (${(result.metadata.size / (1024 * 1024)).toFixed(2)} MB, ${result.metadata.fileCount} files, hash=${result.metadata.overlayHash})`,
  );
}
