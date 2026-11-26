import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/;

const updateJsonVersion = (filePath, nextVersion) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  parsed.version = nextVersion;
  fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
};

const updateCargoTomlVersion = (filePath, nextVersion) => {
  const raw = fs.readFileSync(filePath, "utf8");
  let inPackage = false;
  let updated = false;
  const lines = raw.split(/\r?\n/).map((line) => {
    if (/^\[package\]\s*$/.test(line)) {
      inPackage = true;
      return line;
    }
    if (line.startsWith("[")) {
      inPackage = false;
      return line;
    }
    if (inPackage && /^version\s*=/.test(line) && !updated) {
      updated = true;
      return `version = "${nextVersion}"`;
    }
    return line;
  });
  if (!updated) {
    throw new Error(`Could not find [package] version in ${filePath}`);
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
};

const updateCargoLockVersion = (filePath, packageName, nextVersion) => {
  const raw = fs.readFileSync(filePath, "utf8");
  let foundPkg = false;
  let updated = false;
  const lines = raw.split(/\r?\n/).map((line) => {
    if (line.trim() === `name = "${packageName}"`) {
      foundPkg = true;
      return line;
    }
    if (foundPkg && /^version\s*=/.test(line) && !updated) {
      foundPkg = false;
      updated = true;
      return `version = "${nextVersion}"`;
    }
    if (line.trim() === "" && foundPkg) {
      foundPkg = false;
    }
    return line;
  });
  if (!updated) {
    throw new Error(`Could not find ${packageName} version in ${filePath}`);
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
};

export const bumpTauriVersion = ({
  repoRoot = REPO_ROOT,
  version,
  bumpNativeAbi = false,
  minNativeVersion,
  checkChangelog = false,
  syncLockfile = false,
} = {}) => {
  if (!SEMVER_RE.test(version)) {
    throw new Error(`Invalid semver version "${version}". Expected X.Y.Z or X.Y.Z-beta.N.`);
  }

  const tauriPkg = path.join(repoRoot, "apps", "tauri", "package.json");
  const tauriConf = path.join(repoRoot, "apps", "tauri", "src-tauri", "tauri.conf.json");
  const cargoToml = path.join(repoRoot, "apps", "tauri", "src-tauri", "Cargo.toml");
  const cargoLock = path.join(repoRoot, "apps", "tauri", "src-tauri", "Cargo.lock");
  const nativeAbiPath = path.join(repoRoot, "apps", "tauri", "src-tauri", "native-abi.json");

  updateJsonVersion(tauriPkg, version);
  updateJsonVersion(tauriConf, version);
  updateCargoTomlVersion(cargoToml, version);
  updateCargoLockVersion(cargoLock, "koma-studio-v2", version);

  if (bumpNativeAbi || minNativeVersion) {
    const current = fs.existsSync(nativeAbiPath)
      ? JSON.parse(fs.readFileSync(nativeAbiPath, "utf8"))
      : { nativeAbiVersion: 1, minNativeVersion: version };
    const nextAbi = {
      nativeAbiVersion: bumpNativeAbi ? (Number(current.nativeAbiVersion) || 1) + 1 : (Number(current.nativeAbiVersion) || 1),
      minNativeVersion: minNativeVersion ?? (bumpNativeAbi ? version : String(current.minNativeVersion || version)),
    };
    fs.writeFileSync(nativeAbiPath, `${JSON.stringify(nextAbi, null, 2)}\n`, "utf8");
  }

  if (checkChangelog) {
    const changelog = fs.readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
    const heading = new RegExp(`^## \\[v?${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m");
    if (!heading.test(changelog)) {
      throw new Error(`CHANGELOG.md has no ## [${version}] section`);
    }
  }

  if (syncLockfile) {
    const res = spawnSync("bun", ["install", "--lockfile-only"], {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (res.status !== 0) {
      throw new Error("bun install --lockfile-only failed");
    }
    const frozen = spawnSync("bun", ["install", "--frozen-lockfile", "--lockfile-only"], {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (frozen.status !== 0) {
      throw new Error("bun install --frozen-lockfile --lockfile-only failed");
    }
  }

  return { version };
};

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const args = process.argv.slice(2);
  let version = "";
  let bumpNativeAbi = false;
  let minNativeVersion;
  let checkChangelog = false;
  let syncLockfile = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("-") && !version) {
      version = arg.replace(/^v/, "");
    } else if (arg === "--bump-native-abi") {
      bumpNativeAbi = true;
    } else if (arg === "--min-native-version") {
      minNativeVersion = args[++i];
    } else if (arg === "--check-changelog") {
      checkChangelog = true;
    } else if (arg === "--sync-lockfile") {
      syncLockfile = true;
    }
  }

  if (!version) {
    console.error("Usage: bump-version.mjs <X.Y.Z[-beta.N]> [--bump-native-abi] [--check-changelog] [--sync-lockfile]");
    process.exit(2);
  }
  bumpTauriVersion({ version, bumpNativeAbi, minNativeVersion, checkChangelog, syncLockfile });
  console.log(`[release:bump] stamped Tauri + Cargo + lockfiles to ${version}`);
}
