import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const bundleDir = path.resolve(appDir, "src-tauri", "target", "release", "bundle");

const parseArgs = (argv) => {
  const options = { notes: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--notes") {
      options.notes = argv[++index] ?? "";
    }
  }
  return options;
};

const findUpdaterAsset = (bundleDir, version) => {
  const nsisDir = path.join(bundleDir, "nsis");
  if (!fs.existsSync(nsisDir)) {
    throw new Error(`nsis bundle folder not found: ${nsisDir} — run tauri build first`);
  }

  const entries = fs
    .readdirSync(nsisDir, { withFileTypes: true })
    .toSorted((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name) !== ".exe") continue;
    const versionPattern = new RegExp(`(?<!\\d)${version.replace(/\./g, "\\.")}(?!\\d)`);
    if (!versionPattern.test(entry.name)) continue;
    const installerPath = path.join(nsisDir, entry.name);
    const signaturePath = `${installerPath}.sig`;
    if (!fs.existsSync(signaturePath)) {
      throw new Error(
        `installer ${entry.name} has no .sig twin — updater artifacts were not generated; ` +
          "tauri build must run with the signing key (scripts/with-signing-key.mjs)",
      );
    }
    const signature = fs.readFileSync(signaturePath, "utf8").trim();
    if (signature.length === 0) {
      throw new Error(`signature file ${signaturePath} is empty — refusing to emit a broken feed`);
    }
    return { installerName: entry.name, installerPath, signaturePath, signature };
  }

  throw new Error(
    `no NSIS installer for version ${version} with an updater signature found in ${nsisDir}` +
      " — clean the bundle dir or run tauri build for this version",
  );
};

const readVersion = () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8"));
  if (typeof pkg.version !== "string" || pkg.version.trim().length === 0) {
    throw new Error("apps/tauri/package.json has no version");
  }
  return pkg.version.trim();
};

const options = parseArgs(process.argv.slice(2));
const version = readVersion();
const asset = findUpdaterAsset(bundleDir, version);
const signature = asset.signature;

const manifest = {
  version,
  notes: options.notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/klaus-2/koma-studio/releases/download/v${version}/${asset.installerName}`,
    },
  },
};

const outPath = path.join(bundleDir, "updater-manifest", "latest.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[tauri] updater manifest written: ${outPath}`);
console.log(`[tauri] windows-x86_64 → ${manifest.platforms["windows-x86_64"].url}`);
