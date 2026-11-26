import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectEntriesFromDirectory,
  hashFileSha256,
  hashFileSha512Base64,
  writeTarZst,
} from "./tar-zst.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const readNativeAbiConfig = (repoRoot = REPO_ROOT) => {
  const abiPath = path.join(repoRoot, "apps", "tauri", "src-tauri", "native-abi.json");
  if (!fs.existsSync(abiPath)) {
    return { nativeAbiVersion: 1, minNativeVersion: "1.3.1" };
  }
  const parsed = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  return {
    nativeAbiVersion: Number(parsed.nativeAbiVersion) || 1,
    minNativeVersion: String(parsed.minNativeVersion || "1.3.1"),
  };
};

export const buildUiBundle = async ({
  repoRoot = REPO_ROOT,
  distDir = path.join(repoRoot, "apps", "tauri", "dist"),
  outputDir = path.join(repoRoot, "release-artifacts"),
} = {}) => {
  const indexHtml = path.join(distDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    throw new Error(`Tauri frontend dist missing index.html at ${indexHtml}. Build @koma/tauri first.`);
  }

  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "apps", "tauri", "package.json"), "utf8"),
  );
  const version = String(pkg.version || "").trim();
  if (!version) {
    throw new Error("apps/tauri/package.json has no version");
  }

  const abi = readNativeAbiConfig(repoRoot);
  const manifest = {
    schemaVersion: 1,
    version,
    nativeAbiVersion: abi.nativeAbiVersion,
    minNativeVersion: abi.minNativeVersion,
    generatedAt: new Date().toISOString(),
  };

  const entries = collectEntriesFromDirectory(distDir, {
    includeRootFiles: [
      {
        type: "file",
        tarPath: "ui-bundle-manifest.json",
        data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
        mode: 0o644,
      },
    ],
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const file = `koma-ui-${version}.tar.zst`;
  const archivePath = path.join(outputDir, file);
  await writeTarZst(entries, archivePath, { level: 16 });

  const metadata = {
    ...manifest,
    file,
    sha256: await hashFileSha256(archivePath),
    sha512: await hashFileSha512Base64(archivePath),
    size: fs.statSync(archivePath).size,
  };
  const metaPath = path.join(outputDir, `koma-ui-${version}.json`);
  fs.writeFileSync(metaPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return { archivePath, metaPath, metadata };
};

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const args = process.argv.slice(2);
  let outputDir = path.join(REPO_ROOT, "release-artifacts");
  let distDir = path.join(REPO_ROOT, "apps", "tauri", "dist");
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out" && args[i + 1]) {
      outputDir = path.resolve(args[++i]);
    } else if (args[i] === "--dist" && args[i + 1]) {
      distDir = path.resolve(args[++i]);
    }
  }
  const built = await buildUiBundle({ distDir, outputDir });
  console.log(
    `[release:ui-bundle] built ${built.metadata.file} (${(built.metadata.size / (1024 * 1024)).toFixed(2)} MB, abi=${built.metadata.nativeAbiVersion})`,
  );
}
