import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import type {
  WorkspaceAssetManifestEntry,
  WorkspaceBinaryAssetPayload,
  WorkspacePackageManifestV1,
  WorkspacePackagePayload,
} from "./workspace";

const MANIFEST_PATH = "manifest.json";

const toUint8Array = (buffer: ArrayBuffer): Uint8Array => {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(new Uint8Array(buffer));
  return bytes;
};

const cloneAssetBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const normalizeAssetManifestEntry = (
  entry: WorkspaceAssetManifestEntry,
): WorkspaceAssetManifestEntry => ({
  id: entry.id,
  path: entry.path.replace(/\\/g, "/"),
  fileName: entry.fileName,
  mimeType: entry.mimeType,
  byteLength: entry.byteLength,
});

const buildManifestBytes = (manifest: WorkspacePackageManifestV1): Uint8Array =>
  strToU8(JSON.stringify({
    ...manifest,
    assets: manifest.assets.map(normalizeAssetManifestEntry),
  }, null, 2));

export const buildWorkspacePackageZip = (
  payload: WorkspacePackagePayload,
): Uint8Array => {
  const files: Record<string, Uint8Array> = {
    [MANIFEST_PATH]: buildManifestBytes(payload.manifest),
  };

  payload.assets.forEach((asset) => {
    files[asset.path.replace(/\\/g, "/")] = toUint8Array(asset.buffer);
  });

  return zipSync(files, { level: 6 });
};

export const parseWorkspacePackageZip = (
  zipBytes: Uint8Array,
): WorkspacePackagePayload => {
  const unpacked = unzipSync(zipBytes);
  const manifestBytes = unpacked[MANIFEST_PATH];
  if (!manifestBytes) {
    throw new Error("Invalid workspace: manifest.json missing.");
  }

  let manifest: WorkspacePackageManifestV1;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as WorkspacePackageManifestV1;
  } catch {
    throw new Error("Invalid workspace: manifest.json corrupted.");
  }

  if (manifest.packageVersion !== 1 || manifest.documentVersion !== 1) {
    throw new Error("Workspace incompatible with this app version.");
  }

  const assets: WorkspaceBinaryAssetPayload[] = manifest.assets.map((entry) => {
    const normalizedPath = entry.path.replace(/\\/g, "/");
    const assetBytes = unpacked[normalizedPath];
    if (!assetBytes) {
      throw new Error(`Invalid workspace: missing asset (${normalizedPath}).`);
    }

    return {
      id: entry.id,
      path: normalizedPath,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      buffer: cloneAssetBuffer(assetBytes),
    };
  });

  return {
    manifest,
    assets,
  };
};
