import { createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { signMinisignWithVersion } from "./minisign.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const REPO_SLUG = "klaus-2/koma-studio";

const RUNTIME_MANIFEST_PATTERN = /^(koma-runtime|mini-backend-latest)-[a-z0-9]+-[a-z0-9]+\.json$/;
const V3_RUNTIME_MANIFEST_PATTERN = /^koma-runtime-[a-z0-9]+-[a-z0-9]+\.json$/;

const normalizeEd25519Prefix = (value) => {
  const trimmed = value.trim();
  return trimmed.startsWith("ed25519-") ? trimmed.slice("ed25519-".length) : trimmed;
};

export const signEd25519File = ({ filePath, outputSigPath, privateKeyRaw }) => {
  const trimmed = privateKeyRaw.trim();
  const key = createPrivateKey(
    trimmed.includes("BEGIN")
      ? trimmed
      : { key: Buffer.from(trimmed, "base64"), format: "der", type: "pkcs8" },
  );
  const body = fs.readFileSync(filePath);
  const signature = cryptoSign(null, body, key);
  const formatted = `ed25519-${signature.toString("base64")}\n`;
  fs.writeFileSync(outputSigPath, formatted, "utf8");
  return formatted.trim();
};

export const verifyEd25519Bytes = ({ body, signatureText, publicKeyBase64 }) => {
  const rawKey = Buffer.from(normalizeEd25519Prefix(publicKeyBase64), "base64");
  if (rawKey.length !== 32) {
    throw new Error("Ed25519 public key must be 32 bytes.");
  }
  const key = createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: rawKey.toString("base64url") },
    format: "jwk",
  });
  const rawSig = Buffer.from(normalizeEd25519Prefix(signatureText), "base64");
  if (rawSig.length !== 64) {
    throw new Error("Ed25519 signature must be 64 bytes.");
  }
  return cryptoVerify(null, Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8"), key, rawSig);
};

export const signWithMinisign = ({ filePath, keyPath, version }) =>
  signMinisignWithVersion({
    filePath,
    keyPath,
    password: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
    version,
  });

const runGh = (args, { capture = false, allowFailure = false } = {}) => {
  const res = spawnSync("gh", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : allowFailure ? "pipe" : "inherit",
    shell: false,
  });
  if (res.status !== 0) {
    if (allowFailure) {
      return null;
    }
    throw new Error(`gh ${args.join(" ")} failed (${res.status}): ${res.stderr ?? ""}`);
  }
  return res.stdout ?? "";
};

const ghApiJsonOptional = (endpoint) => {
  const out = runGh(["api", endpoint], { capture: true, allowFailure: true });
  if (!out) {
    return null;
  }
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
};

export const extractReleaseNotes = (version) => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "CHANGELOG.md"), "utf8");
  const lines = raw.split(/\r?\n/);
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startPattern = new RegExp(`^## \\[(?:v)?${escaped}\\]`);
  const nextSectionPattern = /^## \[/;

  let capturing = false;
  const collected = [];
  for (const line of lines) {
    if (!capturing) {
      if (startPattern.test(line)) {
        capturing = true;
      }
      continue;
    }
    if (nextSectionPattern.test(line)) {
      break;
    }
    collected.push(line);
  }
  return collected.join("\n").trim();
};

const resolveSigningKeys = () => {
  const tauriKeyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH
    || path.join(os.homedir(), ".tauri", "koma-studio-updater.key");
  const ed25519KeyPath = process.env.KOMA_RUNTIME_SIGNING_KEY_PATH
    || path.join(os.homedir(), ".koma", "mini-backend-artifacts-ed25519.pem");

  if (!fs.existsSync(tauriKeyPath)) {
    throw new Error(`Tauri Minisign private key missing at ${tauriKeyPath}`);
  }
  if (!fs.existsSync(ed25519KeyPath)) {
    throw new Error(`Runtime Ed25519 private key missing at ${ed25519KeyPath}`);
  }
  return {
    tauriKeyPath,
    ed25519KeyRaw: fs.readFileSync(ed25519KeyPath, "utf8"),
  };
};

const applyOverlayToRuntimeManifest = ({ manifestObj, backendOverlay, version }) => {
  if (!backendOverlay) {
    return manifestObj;
  }
  const existingOverlay = manifestObj.overlay && typeof manifestObj.overlay === "object"
    ? manifestObj.overlay
    : {};
  return {
    ...manifestObj,
    overlay: {
      overlayHash: backendOverlay.overlayHash,
      appVersion: version,
      engineAbi: backendOverlay.engineAbi ?? existingOverlay.engineAbi ?? "v1",
      file: backendOverlay.file,
      url: backendOverlay.url,
      sha256: backendOverlay.sha256,
      sha512: backendOverlay.sha512,
      size: backendOverlay.size,
      entry: existingOverlay.entry ?? "app.py",
      requiredFiles: existingOverlay.requiredFiles ?? ["models/manifests/model-assets.json"],
    },
  };
};

const uploadToBetaChannel = ({ repoSlug, files }) => {
  const existing = runGh(
    ["release", "view", "beta", "--repo", repoSlug, "--json", "tagName"],
    { capture: true, allowFailure: true },
  );
  if (existing) {
    runGh(["release", "upload", "beta", "--repo", repoSlug, "--clobber", ...files]);
    return;
  }
  const created = runGh(
    [
      "release",
      "create",
      "beta",
      "--repo",
      repoSlug,
      "--prerelease",
      "--latest=false",
      "--title",
      "Beta Channel",
      "--notes",
      "Rolling beta update feed for KOMA Studio.",
      ...files,
    ],
    { allowFailure: true },
  );
  if (created === null) {
    console.warn("[sign-and-publish] warning: could not update rolling beta release feed.");
  }
};

export const signAndPublishRelease = async ({
  version,
  repoSlug = REPO_SLUG,
  skipAttestation = false,
  verifyScript = path.join(__dirname, "verify-release.mjs"),
} = {}) => {
  if (!version) {
    throw new Error("version is required (e.g. 1.4.0)");
  }
  const tag = `v${version}`;
  const isBeta = /-beta\.\d+$/.test(version);
  const { tauriKeyPath, ed25519KeyRaw } = resolveSigningKeys();

  const releaseJson = JSON.parse(
    runGh(["release", "view", tag, "--repo", repoSlug, "--json", "isDraft,isPrerelease,assets"], { capture: true }),
  );
  if (!releaseJson.isDraft) {
    throw new Error(`Release ${tag} is already published (not a draft). Refusing to mutate published release.`);
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `koma-sign-${version}-`));
  try {
    runGh(["release", "download", tag, "--repo", repoSlug, "--dir", workDir]);

    const files = fs.readdirSync(workDir);
    if (!skipAttestation) {
      for (const fileName of files) {
        if (fileName.endsWith(".sig") || fileName.endsWith(".json") || fileName.endsWith(".yml")) continue;
        runGh(["attestation", "verify", path.join(workDir, fileName), "--repo", repoSlug]);
      }
    }

    const signedUploadTargets = [];

    const uiArchive = files.find((name) => name === `koma-ui-${version}.tar.zst`);
    let uiBundleDescriptor = null;
    if (uiArchive) {
      const uiPath = path.join(workDir, uiArchive);
      const uiSig = signWithMinisign({ filePath: uiPath, keyPath: tauriKeyPath, version });
      signedUploadTargets.push(`${uiPath}.sig`);
      const uiMetaName = `koma-ui-${version}.json`;
      const uiMeta = files.includes(uiMetaName)
        ? JSON.parse(fs.readFileSync(path.join(workDir, uiMetaName), "utf8"))
        : {};
      uiBundleDescriptor = {
        file: uiArchive,
        url: `https://github.com/${repoSlug}/releases/download/${tag}/${uiArchive}`,
        sha256: uiMeta.sha256 ?? "",
        size: fs.statSync(uiPath).size,
        signature: uiSig,
        nativeAbiVersion: uiMeta.nativeAbiVersion ?? 1,
        minNativeVersion: uiMeta.minNativeVersion ?? version,
      };
    }

    const platformMap = {};
    const installerRules = [
      { key: "windows-x86_64", match: (n) => n.endsWith("-setup-tauri.exe") },
      { key: "windows-x86_64-nsis", match: (n) => n.endsWith("-setup-tauri.exe") },
      { key: "windows-x86_64-msi", match: (n) => n.endsWith("-tauri.msi") },
      { key: "darwin-aarch64", match: (n) => n.endsWith(".app.tar.gz") },
      { key: "linux-x86_64", match: (n) => n.endsWith("-tauri.AppImage") || n.endsWith(".AppImage") },
    ];
    for (const rule of installerRules) {
      const assetName = files.find(rule.match);
      if (!assetName) continue;
      const assetPath = path.join(workDir, assetName);
      const sigPath = `${assetPath}.sig`;
      const signature = signWithMinisign({ filePath: assetPath, keyPath: tauriKeyPath, version });
      if (!signedUploadTargets.includes(sigPath)) {
        signedUploadTargets.push(sigPath);
      }
      platformMap[rule.key] = {
        signature,
        url: `https://github.com/${repoSlug}/releases/download/${tag}/${assetName}`,
      };
    }

    const notes = extractReleaseNotes(version);
    const pubDate = new Date().toISOString();
    const latestJsonPath = path.join(workDir, "latest.json");
    const latestSigPath = `${latestJsonPath}.sig`;

    const latestPublished = ghApiJsonOptional(`repos/${repoSlug}/releases/latest`);
    let carriedLatest = false;
    if (Object.keys(platformMap).length === 0 && latestPublished?.tag_name) {
      const latestAssets = new Set((latestPublished.assets ?? []).map((a) => a.name));
      if (latestAssets.has("latest.json") && latestAssets.has("latest.json.sig")) {
        const carryDir = path.join(workDir, "_carry_latest");
        fs.mkdirSync(carryDir, { recursive: true });
        runGh([
          "release",
          "download",
          latestPublished.tag_name,
          "--repo",
          repoSlug,
          "--dir",
          carryDir,
          "--pattern",
          "latest.json",
          "--pattern",
          "latest.json.sig",
        ]);
        fs.copyFileSync(path.join(carryDir, "latest.json"), latestJsonPath);
        fs.copyFileSync(path.join(carryDir, "latest.json.sig"), latestSigPath);
        signedUploadTargets.push(latestJsonPath, latestSigPath);
        carriedLatest = true;
      }
    }

    if (!carriedLatest) {
      fs.writeFileSync(
        latestJsonPath,
        `${JSON.stringify({ version, notes, pub_date: pubDate, platforms: platformMap }, null, 2)}\n`,
        "utf8",
      );
      signWithMinisign({ filePath: latestJsonPath, keyPath: tauriKeyPath, version });
      signedUploadTargets.push(latestJsonPath, latestSigPath);
    }

    const abiPath = path.join(REPO_ROOT, "apps", "tauri", "src-tauri", "native-abi.json");
    const abi = fs.existsSync(abiPath)
      ? JSON.parse(fs.readFileSync(abiPath, "utf8"))
      : { nativeAbiVersion: 1, minNativeVersion: version };

    const nativeDeltas = {};
    for (const fileName of files) {
      if (/^native-delta-.*\.json$/.test(fileName)) {
        const meta = JSON.parse(fs.readFileSync(path.join(workDir, fileName), "utf8"));
        if (meta && meta.targetKey && meta.file && meta.targetSha256) {
          nativeDeltas[meta.targetKey] = {
            fromVersion: meta.fromVersion,
            url: `https://github.com/${repoSlug}/releases/download/${tag}/${meta.file}`,
            patchSha256: meta.patchSha256 ?? "",
            targetSha256: meta.targetSha256,
            size: meta.size ?? 0,
          };
        }
      }
    }

    const releaseManifestPath = path.join(workDir, "koma-release-manifest.json");
    const releaseManifest = {
      schemaVersion: 1,
      version,
      channel: isBeta ? "beta" : "stable",
      pubDate,
      releaseNotes: notes,
      mandatory: false,
      nativeAbiVersion: Number(abi.nativeAbiVersion) || 1,
      minNativeVersion: String(abi.minNativeVersion || version),
      uiBundle: uiBundleDescriptor,
      backendOverlay: null,
      nativeDeltas,
    };
    const overlayMetaName = files.find((n) => /^koma-backend-overlay-[a-f0-9]+\.json$/.test(n));
    if (overlayMetaName) {
      const om = JSON.parse(fs.readFileSync(path.join(workDir, overlayMetaName), "utf8"));
      releaseManifest.backendOverlay = {
        overlayHash: om.overlayHash,
        appVersion: version,
        engineAbi: om.engineAbi ?? "v1",
        file: om.file,
        url: `https://github.com/${repoSlug}/releases/download/${tag}/${om.file}`,
        sha256: om.sha256,
        sha512: om.sha512,
        size: om.size,
      };
    }
    fs.writeFileSync(releaseManifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, "utf8");
    signWithMinisign({ filePath: releaseManifestPath, keyPath: tauriKeyPath, version });
    signedUploadTargets.push(releaseManifestPath, `${releaseManifestPath}.sig`);

    const runtimeUploadPairs = [];
    const draftRuntimeFiles = files.filter((n) => RUNTIME_MANIFEST_PATTERN.test(n));
    if (draftRuntimeFiles.length > 0) {
      for (const fileName of draftRuntimeFiles) {
        const manifestPath = path.join(workDir, fileName);
        if (V3_RUNTIME_MANIFEST_PATTERN.test(fileName) && releaseManifest.backendOverlay) {
          const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
          const updated = applyOverlayToRuntimeManifest({
            manifestObj: parsed,
            backendOverlay: releaseManifest.backendOverlay,
            version,
          });
          fs.writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
          signedUploadTargets.push(manifestPath);
        }
        const sigOut = `${manifestPath}.sig`;
        signEd25519File({ filePath: manifestPath, outputSigPath: sigOut, privateKeyRaw: ed25519KeyRaw });
        signedUploadTargets.push(sigOut);
        if (V3_RUNTIME_MANIFEST_PATTERN.test(fileName)) {
          runtimeUploadPairs.push(manifestPath, sigOut);
        }
      }
    } else if (latestPublished?.tag_name) {
      const latestRuntimeNames = (latestPublished.assets ?? [])
        .map((a) => a.name)
        .filter((name) => V3_RUNTIME_MANIFEST_PATTERN.test(name));
      if (latestRuntimeNames.length > 0) {
        const runtimeCarryDir = path.join(workDir, "_carry_runtime");
        fs.mkdirSync(runtimeCarryDir, { recursive: true });
        runGh([
          "release",
          "download",
          latestPublished.tag_name,
          "--repo",
          repoSlug,
          "--dir",
          runtimeCarryDir,
          "--pattern",
          "koma-runtime-*.json",
        ]);
        for (const fileName of latestRuntimeNames) {
          const srcPath = path.join(runtimeCarryDir, fileName);
          if (!fs.existsSync(srcPath)) continue;
          const destPath = path.join(workDir, fileName);
          const parsed = JSON.parse(fs.readFileSync(srcPath, "utf8"));
          const updated = applyOverlayToRuntimeManifest({
            manifestObj: parsed,
            backendOverlay: releaseManifest.backendOverlay,
            version,
          });
          fs.writeFileSync(destPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
          const sigOut = `${destPath}.sig`;
          signEd25519File({ filePath: destPath, outputSigPath: sigOut, privateKeyRaw: ed25519KeyRaw });
          signedUploadTargets.push(destPath, sigOut);
          runtimeUploadPairs.push(destPath, sigOut);
        }
      }
    }

    runGh(["release", "upload", tag, "--repo", repoSlug, "--clobber", ...signedUploadTargets]);

    const editArgs = ["release", "edit", tag, "--repo", repoSlug, "--draft=false"];
    if (isBeta) {
      editArgs.push("--prerelease", "--latest=false");
    }
    runGh(editArgs);

    uploadToBetaChannel({
      repoSlug,
      files: [
        latestJsonPath,
        latestSigPath,
        releaseManifestPath,
        `${releaseManifestPath}.sig`,
        ...runtimeUploadPairs,
      ],
    });

    const verified = spawnSync("node", [verifyScript, version], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    if (verified.status !== 0) {
      throw new Error(`Post-publish verification failed for ${tag}`);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
};

export const publishRuntimeEngineRelease = async ({
  engineVersion,
  repoSlug = REPO_SLUG,
  skipAttestation = false,
  verifyScript = path.join(__dirname, "verify-release.mjs"),
} = {}) => {
  if (!engineVersion) {
    throw new Error("engineVersion is required (e.g. 1.0.0)");
  }
  const tag = `runtime-engine-v1-${engineVersion}`;
  const { ed25519KeyRaw } = resolveSigningKeys();

  const releaseJson = JSON.parse(
    runGh(["release", "view", tag, "--repo", repoSlug, "--json", "isDraft,assets"], { capture: true }),
  );
  if (!releaseJson.isDraft) {
    throw new Error(`Runtime engine release ${tag} is already published (not a draft).`);
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `koma-sign-engine-${engineVersion}-`));
  try {
    runGh(["release", "download", tag, "--repo", repoSlug, "--dir", workDir]);
    const files = fs.readdirSync(workDir);

    if (!skipAttestation) {
      for (const fileName of files) {
        if (!fileName.endsWith(".tar.zst")) continue;
        runGh(["attestation", "verify", path.join(workDir, fileName), "--repo", repoSlug]);
      }
    }

    const sigTargets = [];
    const runtimeJsonFiles = files.filter((name) => V3_RUNTIME_MANIFEST_PATTERN.test(name));
    if (runtimeJsonFiles.length === 0) {
      throw new Error(`Draft ${tag} contains no koma-runtime-<plat>-<arch>.json manifests.`);
    }

    for (const fileName of runtimeJsonFiles) {
      const manifestPath = path.join(workDir, fileName);
      const sigOut = `${manifestPath}.sig`;
      signEd25519File({ filePath: manifestPath, outputSigPath: sigOut, privateKeyRaw: ed25519KeyRaw });
      sigTargets.push(sigOut);
    }

    runGh(["release", "upload", tag, "--repo", repoSlug, "--clobber", ...sigTargets]);
    runGh([
      "release",
      "edit",
      tag,
      "--repo",
      repoSlug,
      "--draft=false",
      "--prerelease",
      "--latest=false",
    ]);

    const latestPublished = ghApiJsonOptional(`repos/${repoSlug}/releases/latest`);
    const mirrorRuntimeToRelease = (targetTag) => {
      const mirrorDir = path.join(workDir, `_mirror_${targetTag.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
      fs.mkdirSync(mirrorDir, { recursive: true });
      const existingManifestDl = runGh(
        [
          "release",
          "download",
          targetTag,
          "--repo",
          repoSlug,
          "--dir",
          mirrorDir,
          "--pattern",
          "koma-release-manifest.json",
        ],
        { allowFailure: true },
      );
      let backendOverlay = null;
      let targetVersion = "";
      const rmPath = path.join(mirrorDir, "koma-release-manifest.json");
      if (existingManifestDl !== null && fs.existsSync(rmPath)) {
        const rm = JSON.parse(fs.readFileSync(rmPath, "utf8"));
        backendOverlay = rm.backendOverlay ?? null;
        targetVersion = String(rm.version ?? "");
      }
      const uploadFiles = [];
      for (const fileName of runtimeJsonFiles) {
        const srcParsed = JSON.parse(fs.readFileSync(path.join(workDir, fileName), "utf8"));
        const synced = backendOverlay && targetVersion
          ? applyOverlayToRuntimeManifest({ manifestObj: srcParsed, backendOverlay, version: targetVersion })
          : srcParsed;
        const destJson = path.join(mirrorDir, fileName);
        const destSig = `${destJson}.sig`;
        fs.writeFileSync(destJson, `${JSON.stringify(synced, null, 2)}\n`, "utf8");
        signEd25519File({ filePath: destJson, outputSigPath: destSig, privateKeyRaw: ed25519KeyRaw });
        uploadFiles.push(destJson, destSig);
      }
      runGh(["release", "upload", targetTag, "--repo", repoSlug, "--clobber", ...uploadFiles]);
    };

    if (latestPublished?.tag_name && latestPublished.tag_name !== tag) {
      mirrorRuntimeToRelease(latestPublished.tag_name);
    }
    const betaExists = runGh(
      ["release", "view", "beta", "--repo", repoSlug, "--json", "tagName"],
      { capture: true, allowFailure: true },
    );
    if (betaExists) {
      mirrorRuntimeToRelease("beta");
    }

    const verified = spawnSync("node", [verifyScript, "--runtime-engine", engineVersion], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    if (verified.status !== 0) {
      throw new Error(`Post-publish verification failed for ${tag}`);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
};

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const args = process.argv.slice(2);
  let version = "";
  let runtimeEngineVersion = "";
  let skipAttestation = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--skip-attestation") skipAttestation = true;
    else if (arg === "--runtime-engine" && args[i + 1]) runtimeEngineVersion = args[++i].replace(/^v/, "");
    else if (arg.startsWith("--runtime-engine=")) runtimeEngineVersion = arg.slice("--runtime-engine=".length).replace(/^v/, "");
    else if (!arg.startsWith("-")) version = arg.replace(/^v/, "");
  }

  if (runtimeEngineVersion) {
    await publishRuntimeEngineRelease({ engineVersion: runtimeEngineVersion, skipAttestation });
  } else if (version) {
    await signAndPublishRelease({ version, skipAttestation });
  } else {
    console.error("Usage: sign-and-publish.mjs (<X.Y.Z[-beta.N]> | --runtime-engine <X.Y.Z>) [--skip-attestation]");
    process.exit(2);
  }
}
