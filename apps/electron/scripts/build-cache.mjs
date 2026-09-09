import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE_DIR_NAME = ".build-cache";

const walkFiles = (dir, filterFn = null) => {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".venv-mini" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name === "__pycache__" ||
        entry.name === ".build-cache" ||
        entry.name.startsWith(".venv-mini-")
      ) {
        continue;
      }
      results.push(...walkFiles(fullPath, filterFn));
    } else if (entry.isFile()) {
      if (!filterFn || filterFn(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  return results;
};

export const computeSourceHash = (sourceDirs, options = {}) => {
  const {
    fileFilter = () => true,
    hashAlgorithm = "sha256",
  } = options;

  const hash = createHash(hashAlgorithm);
  const allFiles = [];

  for (const dir of sourceDirs) {
    allFiles.push(...walkFiles(dir, fileFilter));
  }

  allFiles.sort();

  for (const filePath of allFiles) {
    hash.update(filePath);
    const content = fs.readFileSync(filePath);
    hash.update(content);
    const stat = fs.statSync(filePath);
    hash.update(String(stat.mtimeMs));
  }

  return hash.digest("hex");
};

export const getCacheDir = (rootDir, cacheName) => {
  return path.join(rootDir, CACHE_DIR_NAME, cacheName);
};



export const readCachedHash = (cacheDir) => {
  const hashPath = path.join(cacheDir, ".source-hash");
  if (!fs.existsSync(hashPath)) return null;
  try {
    return fs.readFileSync(hashPath, "utf-8").trim();
  } catch {
    return null;
  }
};

export const writeCachedHash = (cacheDir, hash) => {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, ".source-hash"), hash, "utf-8");
};

export const isCacheValid = (cacheDir, currentHash) => {
  const cachedHash = readCachedHash(cacheDir);
  return cachedHash === currentHash;
};


