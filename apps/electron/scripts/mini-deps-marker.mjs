// Fast-path marker for `bun run mini:install-deps`.
// After scripts/ensure-mini-deps.py succeeds, the venv is stamped with a hash
// of every input that decides what gets installed (requirements files,
// installer script and the active acceleration profile). While the stamp
// matches, later runs skip Python entirely instead of re-checking pip state.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MARKER_FILE_NAME = ".koma-mini-deps-marker";

export const listMiniDepsInputFiles = (rootDir) => {
  const requirementsDir = path.join(rootDir, "..", "..", "packages", "mini-backend");
  const requirementsFiles = fs.existsSync(requirementsDir)
    ? fs
        .readdirSync(requirementsDir)
        .filter(
          (name) =>
            name.startsWith("requirements") && name.endsWith(".txt"),
        )
        .sort()
        .map((name) => path.join(requirementsDir, name))
    : [];

  return [
    // monorepo: canonical installer lives in the backend package
    path.join(rootDir, "..", "..", "packages", "mini-backend", "scripts", "ensure-mini-deps.py"),
    ...requirementsFiles,
  ];
};

export const computeMiniDepsMarkerHash = (
  rootDir,
  { profile = "" } = {},
) => {
  const hash = createHash("sha256");
  hash.update(`profile=${String(profile).trim().toLowerCase()}\n`);
  for (const filePath of listMiniDepsInputFiles(rootDir)) {
    hash.update(filePath);
    hash.update(fs.readFileSync(filePath));
  }
  return hash.digest("hex");
};

export const readMiniDepsMarker = (venvDir) => {
  try {
    return fs
      .readFileSync(path.join(venvDir, MARKER_FILE_NAME), "utf-8")
      .trim();
  } catch {
    return null;
  }
};

export const writeMiniDepsMarker = (venvDir, markerHash) => {
  fs.mkdirSync(venvDir, { recursive: true });
  fs.writeFileSync(
    path.join(venvDir, MARKER_FILE_NAME),
    `${markerHash}\n`,
    "utf-8",
  );
};

export const isMiniDepsMarkerFresh = (venvDir, markerHash) =>
  readMiniDepsMarker(venvDir) === markerHash;
