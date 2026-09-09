/**
 * Generates the V2 incremental updater manifest:
 * - hashes release artifacts with SHA-384
 * - writes CAS-ready chunk files
 * - builds Merkle paths for partial verification
 * - optionally generates bsdiff patches for mini-backend.exe
 * - signs the Merkle root with Ed25519
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);

const getArg = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
};

const hasFlag = (name) => args.includes(name);

const version = getArg("--version", process.env.UPDATE_VERSION ?? readPackageVersion());
const channel = getArg("--channel", process.env.UPDATE_CHANNEL ?? inferChannel(version));
const distDir = path.resolve(rootDir, getArg("--dist", "dist"));
const outputDir = path.resolve(rootDir, getArg("--output", "release-desktop/update-manifest"));
const previousDir = getArg("--previous-dir", null);
const baseUrl = getArg("--base-url", process.env.UPDATE_BASE_URL ?? null);
const privateKeyPemPath = getArg("--private-key-pem", process.env.UPDATE_SIGNING_PRIVATE_KEY_PEM_PATH ?? null);
const privateKeyPem = process.env.UPDATE_SIGNING_PRIVATE_KEY_PEM ?? null;
const allowUnsigned = hasFlag("--allow-unsigned");

const log = (message) => console.log(`[build-update-manifest] ${message}`);

function resolveThinTauriConfigJson() {
  return JSON.stringify({
    build: {
      beforeBuildCommand: null,
    },
    bundle: {
      resources: [],
      externalBin: [],
    },
  });
}

function readPackageVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
}

function inferChannel(value) {
  return String(value).includes("-") ? "beta" : "stable";
}

function sha384(buffer) {
  return crypto.createHash("sha384").update(buffer).digest();
}

function sha384Hex(buffer) {
  return sha384(buffer).toString("hex");
}

function integrity(buffer) {
  return `sha384-${sha384Hex(buffer)}`;
}

function collectFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else if (entry.isFile() && !entry.name.endsWith(".map")) {
      files.push(path.relative(base, fullPath).replace(/\\/g, "/"));
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function pairHash(left, right) {
  return sha384(Buffer.concat([left, right]));
}

function buildMerkle(hashes) {
  if (hashes.length === 0) {
    return { root: sha384(Buffer.alloc(0)), paths: [] };
  }

  const paths = hashes.map(() => []);
  let level = hashes.map((hash, index) => ({ hash, indexes: [index] }));

  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      for (const leafIndex of left.indexes) {
        paths[leafIndex].push({
          hash: `sha384-${right.hash.toString("hex")}`,
          position: "right",
        });
      }
      for (const leafIndex of right.indexes) {
        if (right !== left) {
          paths[leafIndex].push({
            hash: `sha384-${left.hash.toString("hex")}`,
            position: "left",
          });
        }
      }
      next.push({
        hash: pairHash(left.hash, right.hash),
        indexes: [...left.indexes, ...(right === left ? [] : right.indexes)],
      });
    }
    level = next;
  }

  return { root: level[0].hash, paths };
}

function chunkFileName(hashHex, sourceName) {
  const extension = path.extname(sourceName).replace(/^\./, "") || "bin";
  return `${hashHex}.${extension}`;
}

function copyChunk(sourcePath, hashHex, sourceName) {
  const targetName = chunkFileName(hashHex, sourceName);
  const target = path.join(outputDir, "chunks", targetName);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return targetName;
}

function signRoot(root) {
  const pem = privateKeyPemPath
    ? fs.readFileSync(path.resolve(rootDir, privateKeyPemPath), "utf8")
    : privateKeyPem;
  if (!pem) {
    if (allowUnsigned) {
      return { signature: "ed25519-unsigned", publicKey: null };
    }
    throw new Error(
      "Missing Ed25519 signing key. Set UPDATE_SIGNING_PRIVATE_KEY_PEM, UPDATE_SIGNING_PRIVATE_KEY_PEM_PATH, or pass --allow-unsigned for local tests.",
    );
  }

  const privateKey = crypto.createPrivateKey(pem);
  const publicKey = crypto.createPublicKey(privateKey);
  const signature = crypto.sign(null, Buffer.from(root), privateKey);
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  return {
    signature: `ed25519-${signature.toString("base64")}`,
    publicKey: `spki-ed25519-${Buffer.from(publicKeyDer).toString("base64")}`,
  };
}

function findMiniBackendBinary(dir) {
  const candidates = [
    "mini-backend.exe",
    "mini-backend",
    "bin/mini-backend.exe",
    "bin/mini-backend",
    "src-tauri/bin/mini-backend.exe",
    "src-tauri/bin/mini-backend",
  ];
  for (const candidate of candidates) {
    const full = path.join(dir, candidate);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return full;
    }
  }
  return null;
}

function maybeBuildBinaryDelta() {
  if (!previousDir) {
    return [];
  }
  const previous = findMiniBackendBinary(path.resolve(rootDir, previousDir));
  const current = findMiniBackendBinary(distDir);
  if (!previous || !current) {
    log("Skipping bsdiff: mini-backend binary not found in previous/current directories.");
    return [];
  }

  const patchFile = path.join(outputDir, "deltas", `mini-backend-${version}.bsdiff`);
  execFileSync(
    "cargo",
    [
      "run",
      "--quiet",
      "--manifest-path",
      path.join(rootDir, "src-tauri", "Cargo.toml"),
      "--features",
      "updater-tools",
      "--bin",
      "make_bsdiff",
      "--",
      previous,
      current,
      patchFile,
    ],
    {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        KOMA_EMBEDDED_MINI_BACKEND: "0",
        TAURI_CONFIG: resolveThinTauriConfigJson(),
      },
    },
  );

  const patchBytes = fs.readFileSync(patchFile);
  const targetBytes = fs.readFileSync(current);
  return [
    {
      artifact: "mini-backend.exe",
      fromVersion: path.basename(path.resolve(rootDir, previousDir)),
      toVersion: version,
      patchHash: integrity(patchBytes),
      patchSize: patchBytes.length,
      targetHash: integrity(targetBytes),
      targetSize: targetBytes.length,
      patchUrl: baseUrl ? new URL(`deltas/${path.basename(patchFile)}`, ensureTrailingSlash(baseUrl)).toString() : `deltas/${path.basename(patchFile)}`,
    },
  ];
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

if (!fs.existsSync(distDir)) {
  throw new Error(`dist directory not found: ${distDir}`);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const files = collectFiles(distDir);
const hashes = files.map((file) => sha384(fs.readFileSync(path.join(distDir, file))));
const merkle = buildMerkle(hashes);
const chunks = {};

files.forEach((file, index) => {
  const fullPath = path.join(distDir, file);
  const bytes = fs.readFileSync(fullPath);
  const hashHex = hashes[index].toString("hex");
  const chunkName = copyChunk(fullPath, hashHex, file);
  chunks[file] = {
    hash: `sha384-${hashHex}`,
    size: bytes.length,
    url: baseUrl ? new URL(`chunks/${chunkName}`, ensureTrailingSlash(baseUrl)).toString() : `chunks/${chunkName}`,
    path: merkle.paths[index],
    contentType: contentTypeFor(file),
  };
});

const merkleRoot = `sha384-${merkle.root.toString("hex")}`;
const signing = signRoot(merkleRoot);
const manifest = {
  version,
  channel,
  generatedAt: new Date().toISOString(),
  baseUrl,
  merkleRoot,
  signature: signing.signature,
  publicKey: signing.publicKey,
  chunks,
  binaryDeltas: maybeBuildBinaryDelta(),
  modelDeltas: [],
};

const manifestPath = path.join(outputDir, "manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
log(`manifest=${manifestPath}`);
log(`chunks=${Object.keys(chunks).length}`);
log(`merkleRoot=${merkleRoot}`);

function contentTypeFor(file) {
  switch (path.extname(file).toLowerCase()) {
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
