import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyTauriMinisignFile } from "./minisign.mjs";
import { verifyEd25519Bytes } from "./sign-and-publish.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const REPO_SLUG = "klaus-2/koma-studio";
const DEFAULT_RUNTIME_PUBKEY = "HdJwZKhP6eGVAVUrWh5QdYtlEPW5kzqsbD9xRNlN98w=";

const readCargoVersion = (cargoPath) => {
  const raw = fs.readFileSync(cargoPath, "utf8");
  let inPkg = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^\[package\]\s*$/.test(line)) inPkg = true;
    else if (line.startsWith("[")) inPkg = false;
    else if (inPkg) {
      const m = line.match(/^version\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    }
  }
  return null;
};

const readTauriUpdaterPubkey = () => {
  const tauriConf = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "apps/tauri/src-tauri/tauri.conf.json"), "utf8"),
  );
  const pubkey = tauriConf?.plugins?.updater?.pubkey;
  if (!pubkey || typeof pubkey !== "string") {
    throw new Error("apps/tauri/src-tauri/tauri.conf.json missing plugins.updater.pubkey");
  }
  return pubkey.trim();
};

const runGhJson = (args, { allowFailure = false } = {}) => {
  const res = spawnSync("gh", args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (res.status !== 0) {
    if (allowFailure) {
      return null;
    }
    throw new Error(`gh ${args.join(" ")} failed: ${res.stderr}`);
  }
  return JSON.parse(res.stdout);
};

const verifyMinisignAsset = async ({
  byName,
  assetName,
  expectedVersion,
  pubkeyText,
  parseJson = false,
  failures,
}) => {
  const asset = byName.get(assetName);
  const sigAsset = byName.get(`${assetName}.sig`);
  if (!asset || !sigAsset) {
    failures.push(`missing ${assetName} or ${assetName}.sig`);
    return null;
  }

  const [assetRes, sigRes] = await Promise.all([
    fetch(asset.browser_download_url),
    fetch(sigAsset.browser_download_url),
  ]);
  if (!assetRes.ok || !sigRes.ok) {
    failures.push(`failed fetching ${assetName} (${assetRes.status}) or .sig (${sigRes.status})`);
    return null;
  }

  const bytes = Buffer.from(await assetRes.arrayBuffer());
  const sigText = await sigRes.text();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-verify-minisign-"));
  let parsedJson = null;
  try {
    const filePath = path.join(tempDir, path.basename(assetName));
    fs.writeFileSync(filePath, bytes);
    const verified = verifyTauriMinisignFile({ filePath, sigText, pubkeyText });
    if (!verified.valid) {
      failures.push(`Minisign verification failed on ${assetName}: ${verified.reason ?? "invalid"}`);
      return null;
    }

    if (parseJson) {
      parsedJson = JSON.parse(bytes.toString("utf8"));
    }

    const wantVersion = expectedVersion ?? (parsedJson?.version ? String(parsedJson.version) : null);
    if (!verified.signedVersion) {
      failures.push(`${assetName}.sig missing trusted version: field (requireSignedVersion=true)`);
    } else if (wantVersion && verified.signedVersion !== wantVersion) {
      failures.push(`${assetName}.sig signedVersion=${verified.signedVersion} expected ${wantVersion}`);
    }
  } catch (error) {
    failures.push(`error verifying Minisign on ${assetName}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return parsedJson;
};

const verifyRuntimeManifestsOnRelease = async ({ byName, runtimeManifestNames, runtimePubkey, failures }) => {
  for (const name of runtimeManifestNames) {
    const sigAsset = byName.get(`${name}.sig`);
    if (!sigAsset) {
      failures.push(`unsigned runtime manifest: ${name}`);
      continue;
    }
    const [manifestRes, sigRes] = await Promise.all([
      fetch(byName.get(name).browser_download_url),
      fetch(sigAsset.browser_download_url),
    ]);
    if (!manifestRes.ok || !sigRes.ok) {
      failures.push(`failed fetching ${name} or .sig`);
      continue;
    }
    const manifestText = await manifestRes.text();
    const sigText = await sigRes.text();
    if (!verifyEd25519Bytes({ body: manifestText, signatureText: sigText, publicKeyBase64: runtimePubkey })) {
      failures.push(`Ed25519 signature invalid on ${name}`);
    }
    const parsed = JSON.parse(manifestText);
    for (const [profile, record] of Object.entries(parsed.profiles ?? {})) {
      for (const part of record.parts ?? []) {
        const probe = await fetch(part.url, { headers: { Range: "bytes=0-0" } });
        if (!probe.ok && probe.status !== 206) {
          failures.push(`${profile} part unreachable (${probe.status}): ${part.url}`);
        }
      }
    }
  }
};

export const verifyRemoteRelease = async ({
  version,
  repoSlug = REPO_SLUG,
  runtimePubkey = process.env.KOMA_MINI_BACKEND_ARTIFACTS_PUBKEY || DEFAULT_RUNTIME_PUBKEY,
} = {}) => {
  const tag = `v${version}`;
  const isBeta = /-beta\.\d+$/.test(version);
  const failures = [];
  const tauriPubkey = readTauriUpdaterPubkey();

  const tauriPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "apps/tauri/package.json"), "utf8"));
  const tauriConf = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "apps/tauri/src-tauri/tauri.conf.json"), "utf8"));
  const cargoVer = readCargoVersion(path.join(REPO_ROOT, "apps/tauri/src-tauri/Cargo.toml"));

  if (tauriPkg.version !== version) failures.push(`apps/tauri/package.json=${tauriPkg.version} != ${version}`);
  if (tauriConf.version !== version) failures.push(`tauri.conf.json=${tauriConf.version} != ${version}`);
  if (cargoVer !== version) failures.push(`Cargo.toml=${cargoVer} != ${version}`);

  const changelog = fs.readFileSync(path.join(REPO_ROOT, "CHANGELOG.md"), "utf8");
  if (!new RegExp(`^## \\[(?:v)?${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m").test(changelog)) {
    failures.push(`CHANGELOG.md missing section for ${version}`);
  }

  const release = runGhJson(["api", `repos/${repoSlug}/releases/tags/${tag}`]);

  if (release.draft !== false) failures.push(`${tag} is still a draft`);
  if (Boolean(release.prerelease) !== isBeta) {
    failures.push(`${tag} prerelease=${release.prerelease} expected ${isBeta}`);
  }

  if (isBeta) {
    const latest = runGhJson(["api", `repos/${repoSlug}/releases/latest`], { allowFailure: true });
    if (latest?.tag_name === tag) {
      failures.push(`Beta tag ${tag} hijacked /releases/latest!`);
    }
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const byName = new Map(assets.map((asset) => [asset.name, asset]));

  const releaseManifest = await verifyMinisignAsset({
    byName,
    assetName: "koma-release-manifest.json",
    expectedVersion: version,
    pubkeyText: tauriPubkey,
    parseJson: true,
    failures,
  });
  if (releaseManifest && releaseManifest.version !== version) {
    failures.push(`koma-release-manifest.json version=${releaseManifest.version} expected ${version}`);
  }

  await verifyMinisignAsset({
    byName,
    assetName: "latest.json",
    expectedVersion: null,
    pubkeyText: tauriPubkey,
    parseJson: true,
    failures,
  });

  const uiArchiveName = `koma-ui-${version}.tar.zst`;
  if (byName.has(uiArchiveName)) {
    await verifyMinisignAsset({
      byName,
      assetName: uiArchiveName,
      expectedVersion: version,
      pubkeyText: tauriPubkey,
      parseJson: false,
      failures,
    });
  }

  const runtimeManifestNames = [...byName.keys()].filter((name) =>
    /^(koma-runtime|mini-backend-latest)-[a-z0-9]+-[a-z0-9]+\.json$/.test(name),
  );
  const hasOtaAssets = byName.has(uiArchiveName) && byName.has(`${uiArchiveName}.sig`);
  if (!hasOtaAssets && runtimeManifestNames.length === 0) {
    failures.push("release missing both UI OTA bundle and runtime manifests");
  }

  await verifyRuntimeManifestsOnRelease({
    byName,
    runtimeManifestNames,
    runtimePubkey,
    failures,
  });

  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    return { ok: false, failures };
  }
  console.log(`PASS: ${tag} verified (${assets.length} assets, ${runtimeManifestNames.length} signed runtime manifests)`);
  return { ok: true, failures: [] };
};

export const verifyRuntimeEngineRelease = async ({
  engineVersion,
  repoSlug = REPO_SLUG,
  runtimePubkey = process.env.KOMA_MINI_BACKEND_ARTIFACTS_PUBKEY || DEFAULT_RUNTIME_PUBKEY,
} = {}) => {
  const tag = `runtime-engine-v1-${engineVersion}`;
  const failures = [];

  const release = runGhJson(["api", `repos/${repoSlug}/releases/tags/${tag}`]);
  if (release.draft !== false) failures.push(`${tag} is still a draft`);
  if (release.prerelease !== true) failures.push(`${tag} must be marked prerelease=true`);

  const latest = runGhJson(["api", `repos/${repoSlug}/releases/latest`], { allowFailure: true });
  if (latest?.tag_name === tag) {
    failures.push(`Runtime engine tag ${tag} hijacked /releases/latest!`);
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const byName = new Map(assets.map((asset) => [asset.name, asset]));
  const runtimeManifestNames = [...byName.keys()].filter((name) =>
    /^koma-runtime-[a-z0-9]+-[a-z0-9]+\.json$/.test(name),
  );
  if (runtimeManifestNames.length === 0) {
    failures.push(`${tag} has no koma-runtime-<plat>-<arch>.json manifests`);
  }

  await verifyRuntimeManifestsOnRelease({
    byName,
    runtimeManifestNames,
    runtimePubkey,
    failures,
  });

  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    return { ok: false, failures };
  }
  console.log(`PASS: ${tag} verified (${assets.length} assets, ${runtimeManifestNames.length} signed manifests)`);
  return { ok: true, failures: [] };
};

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const args = process.argv.slice(2);
  let version = "";
  let engineVersion = "";
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--runtime-engine" && args[i + 1]) engineVersion = args[++i].replace(/^v/, "");
    else if (arg.startsWith("--runtime-engine=")) engineVersion = arg.slice("--runtime-engine=".length).replace(/^v/, "");
    else if (!arg.startsWith("-")) version = arg.replace(/^v/, "");
  }

  if (engineVersion) {
    const result = await verifyRuntimeEngineRelease({ engineVersion });
    process.exit(result.ok ? 0 : 1);
  } else if (version) {
    const result = await verifyRemoteRelease({ version });
    process.exit(result.ok ? 0 : 1);
  } else {
    console.error("Usage: verify-release.mjs (<X.Y.Z[-beta.N]> | --runtime-engine <X.Y.Z>)");
    process.exit(2);
  }
}
