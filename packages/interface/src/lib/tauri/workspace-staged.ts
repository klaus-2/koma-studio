import { desktopCommandChannels } from "@shared/desktop-api";
import type {
  WorkspaceAutosaveLoadResult,
  WorkspaceAutosaveSavePayload,
  WorkspaceAutosaveSaveResult,
  WorkspaceBinaryAssetPayload,
  WorkspaceExportPayload,
  WorkspaceExportResult,
  WorkspaceImportResult,
  WorkspacePackageManifestV1,
  WorkspacePackagePayload,
} from "@shared/workspace";

import { invokeCommand } from "./invoke";

const MAX_STAGED_CACHE_ENTRIES = 512;
const RETRYABLE_STAGED_ERROR = /authorization|expired|changed|staged/i;

const stagedTokenBySha256 = new Map<string, string>();

interface StagedAssetReceipt {
  sourceToken: string;
  sha256: string;
  byteLength: number;
}

interface StagedAssetDescriptor {
  id: string;
  path: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
  sourceToken: string;
  sha256: string;
}

interface StagedAutosaveLoadResponse {
  found: boolean;
  path: string | null;
  manifest?: WorkspacePackageManifestV1;
  assets: StagedAssetDescriptor[];
}

interface StagedImportResponse {
  cancelled: boolean;
  filePath: string | null;
  manifest?: WorkspacePackageManifestV1;
  assets: StagedAssetDescriptor[];
}

export const toArrayBuffer = (value: ArrayBuffer | Uint8Array): ArrayBuffer => {
  if (value instanceof ArrayBuffer) {
    return value;
  }
  if (
    value.byteOffset === 0 &&
    value.byteLength === value.buffer.byteLength &&
    value.buffer instanceof ArrayBuffer
  ) {
    return value.buffer;
  }
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
};

export const resetStagedAssetCacheForTests = (): void => {
  stagedTokenBySha256.clear();
};

const cacheStagedToken = (sha256: string, sourceToken: string): void => {
  stagedTokenBySha256.delete(sha256);
  while (stagedTokenBySha256.size >= MAX_STAGED_CACHE_ENTRIES) {
    const oldest = stagedTokenBySha256.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    stagedTokenBySha256.delete(oldest);
  }
  stagedTokenBySha256.set(sha256, sourceToken);
};

const readCachedStagedToken = (sha256: string): string | undefined => {
  const token = stagedTokenBySha256.get(sha256);
  if (token === undefined) {
    return undefined;
  }
  stagedTokenBySha256.delete(sha256);
  stagedTokenBySha256.set(sha256, token);
  return token;
};

const computeSha256Hex = async (buffer: ArrayBuffer): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(buffer),
  );
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
};

const alignManifestAssets = (
  payload: WorkspacePackagePayload,
): WorkspaceBinaryAssetPayload[] => {
  if (payload.assets.length !== payload.manifest.assets.length) {
    throw new Error("Workspace manifest and staged asset counts do not match.");
  }
  const byId = new Map(payload.assets.map((asset) => [asset.id, asset]));
  return payload.manifest.assets.map((entry) => {
    const asset = byId.get(entry.id);
    if (!asset) {
      throw new Error(`Missing binary payload for workspace asset ${entry.id}.`);
    }
    return asset;
  });
};

const stageAssets = async (
  payload: WorkspacePackagePayload,
): Promise<{ refs: Array<{ sourceToken: string }>; hashes: string[] }> => {
  const aligned = alignManifestAssets(payload);
  const refs: Array<{ sourceToken: string }> = [];
  const hashes: string[] = [];

  for (const asset of aligned) {
    const sha256 = await computeSha256Hex(asset.buffer);
    hashes.push(sha256);
    const cached = readCachedStagedToken(sha256);
    if (cached !== undefined) {
      refs.push({ sourceToken: cached });
      continue;
    }
    const receipt = await invokeCommand<StagedAssetReceipt>(
      desktopCommandChannels.workspace.stageAssetRaw,
      asset.buffer,
      {
        headers: {
          "x-koma-asset-id": encodeURIComponent(asset.id),
          "x-koma-asset-path": encodeURIComponent(asset.path),
          "x-koma-file-name": encodeURIComponent(asset.fileName),
          "x-koma-mime-type": encodeURIComponent(asset.mimeType),
        },
      },
    );
    cacheStagedToken(sha256, receipt.sourceToken);
    refs.push({ sourceToken: receipt.sourceToken });
  }

  return { refs, hashes };
};

const commitWithRetry = async <T>(
  payload: WorkspacePackagePayload,
  commit: (refs: Array<{ sourceToken: string }>) => Promise<T>,
): Promise<T> => {
  const first = await stageAssets(payload);
  try {
    return await commit(first.refs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!RETRYABLE_STAGED_ERROR.test(message)) {
      throw error;
    }
    for (const hash of first.hashes) {
      stagedTokenBySha256.delete(hash);
    }
    const retry = await stageAssets(payload);
    return commit(retry.refs);
  }
};

const hydrateAssets = async (
  descriptors: StagedAssetDescriptor[],
): Promise<WorkspaceBinaryAssetPayload[]> => {
  return Promise.all(
    descriptors.map(async (descriptor) => {
      const raw = await invokeCommand<ArrayBuffer | Uint8Array>(
        desktopCommandChannels.workspace.readStagedAsset,
        { assetId: descriptor.id, sourceToken: descriptor.sourceToken },
      );
      cacheStagedToken(descriptor.sha256, descriptor.sourceToken);
      return {
        id: descriptor.id,
        path: descriptor.path,
        fileName: descriptor.fileName,
        mimeType: descriptor.mimeType,
        buffer: toArrayBuffer(raw),
      };
    }),
  );
};

export const saveStagedAutosave = (
  payload: WorkspaceAutosaveSavePayload,
): Promise<WorkspaceAutosaveSaveResult> =>
  commitWithRetry(payload.payload, (assets) =>
    invokeCommand<WorkspaceAutosaveSaveResult>(
      desktopCommandChannels.workspace.commitStagedAutosave,
      {
        userId: payload.userId ?? null,
        manifest: payload.payload.manifest,
        assets,
      },
    ),
  );

export const exportStagedWorkspace = (
  payload: WorkspaceExportPayload,
): Promise<WorkspaceExportResult> =>
  commitWithRetry(payload.payload, (assets) =>
    invokeCommand<WorkspaceExportResult>(
      desktopCommandChannels.workspace.commitStagedExport,
      {
        defaultFileName: payload.defaultFileName,
        manifest: payload.payload.manifest,
        assets,
      },
    ),
  );

export const loadStagedAutosave = async (
  userId?: string | null,
): Promise<WorkspaceAutosaveLoadResult> => {
  const response = await invokeCommand<StagedAutosaveLoadResponse>(
    desktopCommandChannels.workspace.loadAutosaveStaged,
    { userId: userId ?? null },
  );
  if (!response.found || !response.manifest) {
    return { found: false, path: response.path ?? null, payload: null };
  }
  return {
    found: true,
    path: response.path ?? null,
    payload: {
      manifest: response.manifest,
      assets: await hydrateAssets(response.assets),
    },
  };
};

export const importStagedWorkspace = async (): Promise<WorkspaceImportResult> => {
  const response = await invokeCommand<StagedImportResponse>(
    desktopCommandChannels.workspace.importFileStaged,
  );
  if (response.cancelled || !response.manifest) {
    return { cancelled: response.cancelled, filePath: response.filePath ?? null, payload: null };
  }
  return {
    cancelled: false,
    filePath: response.filePath ?? null,
    payload: {
      manifest: response.manifest,
      assets: await hydrateAssets(response.assets),
    },
  };
};
