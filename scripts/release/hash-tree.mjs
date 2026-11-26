import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  ".turbo",
  ".build-cache",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".cache",
  "__pycache__",
  "node_modules",
  "dist",
  "build",
]);

const DEFAULT_IGNORED_PREFIXES = [".venv"];
const DEFAULT_IGNORED_SUFFIXES = [".pyc", ".pyo"];

const toPosix = (value) => value.split(path.sep).join("/");

const shouldIgnoreDir = (name, extraIgnoredDirs, excludeTests) => {
  if (DEFAULT_IGNORED_DIRS.has(name) || extraIgnoredDirs.has(name)) {
    return true;
  }
  if (DEFAULT_IGNORED_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return true;
  }
  if (excludeTests && (name === "tests" || name === "__tests__")) {
    return true;
  }
  return false;
};

const shouldIgnoreFile = (name, excludeTests) => {
  if (DEFAULT_IGNORED_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    return true;
  }
  if (excludeTests && (name.startsWith("test_") || /\.test\.|\.spec\./.test(name))) {
    return true;
  }
  return false;
};

export const collectDeterministicFiles = (
  rootPath,
  {
    baseDir = rootPath,
    extraIgnoredDirs = new Set(),
    excludeTests = false,
  } = {},
) => {
  const results = [];
  const resolvedRoot = path.resolve(rootPath);
  const resolvedBase = path.resolve(baseDir);

  if (!fs.existsSync(resolvedRoot)) {
    return results;
  }

  const rootStat = fs.statSync(resolvedRoot);
  if (rootStat.isFile()) {
    const relPath = toPosix(path.relative(resolvedBase, resolvedRoot));
    results.push({
      absPath: resolvedRoot,
      relPath,
      isExecutable: process.platform !== "win32" && (rootStat.mode & 0o111) !== 0,
    });
    return results;
  }

  const visit = (dir) => {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .toSorted((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldIgnoreDir(entry.name, extraIgnoredDirs, excludeTests)) {
          visit(absPath);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (shouldIgnoreFile(entry.name, excludeTests)) {
        continue;
      }
      const stat = fs.statSync(absPath);
      const relPath = toPosix(path.relative(resolvedBase, absPath));
      results.push({
        absPath,
        relPath,
        isExecutable: process.platform !== "win32" && (stat.mode & 0o111) !== 0,
      });
    }
  };

  visit(resolvedRoot);
  results.sort((left, right) => left.relPath.localeCompare(right.relPath));
  return results;
};

export const computeContentTreeHash = (
  targets,
  {
    baseDir,
    extraIgnoredDirs = new Set(),
    excludeTests = false,
  } = {},
) => {
  const hash = createHash("sha256");
  const allFiles = [];

  for (const target of targets) {
    const resolvedTarget = path.resolve(target);
    if (!fs.existsSync(resolvedTarget)) {
      continue;
    }
    const anchor = baseDir ? path.resolve(baseDir) : resolvedTarget;
    allFiles.push(
      ...collectDeterministicFiles(resolvedTarget, {
        baseDir: anchor,
        extraIgnoredDirs,
        excludeTests,
      }),
    );
  }

  allFiles.sort((left, right) => left.relPath.localeCompare(right.relPath));
  const seen = new Set();

  for (const file of allFiles) {
    if (seen.has(file.relPath)) {
      continue;
    }
    seen.add(file.relPath);
    const bytes = fs.readFileSync(file.absPath);
    const fileDigest = createHash("sha256").update(bytes).digest("hex");
    hash.update(`${file.relPath}\0${file.isExecutable ? "x" : "-"}\0${fileDigest}\n`);
  }

  return hash.digest("hex");
};
