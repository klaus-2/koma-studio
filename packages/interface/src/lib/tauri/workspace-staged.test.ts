import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { desktopCommandChannels } from "@shared/desktop-api";
import type {
  WorkspaceDocumentV1,
  WorkspacePackageManifestV1,
  WorkspacePackagePayload,
} from "@shared/workspace";

import {
  loadStagedAutosave,
  resetStagedAssetCacheForTests,
  saveStagedAutosave,
} from "./workspace-staged";

const mockedInvoke = vi.mocked(invoke);

const buildPayload = (
  assetId: string,
  bytes: Uint8Array,
): WorkspacePackagePayload => {
  const buffer = bytes.slice().buffer;
  const manifest: WorkspacePackageManifestV1 = {
    packageVersion: 1,
    exportedAt: "2026-11-25T00:00:00.000Z",
    app: "koma-studio",
    documentVersion: 1,
    document: { version: 1 } as unknown as WorkspaceDocumentV1,
    assets: [
      {
        id: assetId,
        path: `assets/${assetId}.png`,
        fileName: "page.png",
        mimeType: "image/png",
        byteLength: buffer.byteLength,
      },
    ],
  };
  return {
    manifest,
    assets: [
      {
        id: assetId,
        path: `assets/${assetId}.png`,
        fileName: "page.png",
        mimeType: "image/png",
        buffer,
      },
    ],
  };
};

describe("workspace-staged IPC", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    resetStagedAssetCacheForTests();
  });

  it("deduplicates staged assets by sha256 when asset UUIDs regenerate", async () => {
    const firstBytes = new Uint8Array([1, 2, 3, 4]);
    const firstPayload = buildPayload("uuid-1", firstBytes);
    const secondPayload = buildPayload("uuid-2", firstBytes);

    mockedInvoke
      .mockResolvedValueOnce({
        sourceToken: "tok-1",
        sha256: "hash-1",
        byteLength: 4,
      })
      .mockResolvedValueOnce({ saved: true, path: "C:/autosave.koma" })
      .mockResolvedValueOnce({ saved: true, path: "C:/autosave.koma" });

    await saveStagedAutosave({ userId: "u1", payload: firstPayload });
    await saveStagedAutosave({ userId: "u1", payload: secondPayload });

    const stageCalls = mockedInvoke.mock.calls.filter(
      ([cmd]) => cmd === desktopCommandChannels.workspace.stageAssetRaw,
    );
    const commitCalls = mockedInvoke.mock.calls.filter(
      ([cmd]) => cmd === desktopCommandChannels.workspace.commitStagedAutosave,
    );
    expect(stageCalls).toHaveLength(1);
    expect(stageCalls[0]?.[1]).toBeInstanceOf(ArrayBuffer);
    expect(commitCalls).toHaveLength(2);
    expect(commitCalls[1]?.[1]).toMatchObject({
      assets: [{ sourceToken: "tok-1" }],
    });
  });

  it("evicts stale cached tokens and retries once when authorization expires", async () => {
    const payload = buildPayload("uuid-1", new Uint8Array([9, 8, 7]));

    mockedInvoke
      .mockResolvedValueOnce({
        sourceToken: "tok-old",
        sha256: "hash-a",
        byteLength: 3,
      })
      .mockResolvedValueOnce({ saved: true, path: "C:/autosave.koma" })
      .mockRejectedValueOnce({
        kind: "security",
        message: "The workspace asset authorization is invalid or expired.",
      })
      .mockResolvedValueOnce({
        sourceToken: "tok-fresh",
        sha256: "hash-a",
        byteLength: 3,
      })
      .mockResolvedValueOnce({ saved: true, path: "C:/autosave.koma" });

    await saveStagedAutosave({ userId: null, payload });
    const retried = await saveStagedAutosave({
      userId: null,
      payload: buildPayload("uuid-2", new Uint8Array([9, 8, 7])),
    });

    expect(retried.saved).toBe(true);
    const stageCalls = mockedInvoke.mock.calls.filter(
      ([cmd]) => cmd === desktopCommandChannels.workspace.stageAssetRaw,
    );
    expect(stageCalls).toHaveLength(2);
    expect(mockedInvoke).toHaveBeenLastCalledWith(
      desktopCommandChannels.workspace.commitStagedAutosave,
      expect.objectContaining({ assets: [{ sourceToken: "tok-fresh" }] }),
    );
  });

  it("seeds the sha256 token cache when loading a staged autosave", async () => {
    const bytes = new Uint8Array([5, 6, 7, 8]);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const expectedSha = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const payload = buildPayload("uuid-loaded", bytes);

    mockedInvoke
      .mockResolvedValueOnce({
        found: true,
        path: "C:/autosave.koma",
        manifest: payload.manifest,
        assets: [
          {
            id: "uuid-loaded",
            path: "assets/uuid-loaded.png",
            fileName: "page.png",
            mimeType: "image/png",
            byteLength: 4,
            sourceToken: "tok-from-load",
            sha256: expectedSha,
          },
        ],
      })
      .mockResolvedValueOnce(bytes.buffer)
      .mockResolvedValueOnce({ saved: true, path: "C:/autosave.koma" });

    const loaded = await loadStagedAutosave("user-1");
    expect(loaded.found).toBe(true);
    expect(new Uint8Array(loaded.payload?.assets[0]?.buffer ?? new ArrayBuffer(0))).toEqual(
      bytes,
    );

    await saveStagedAutosave({
      userId: "user-1",
      payload: buildPayload("uuid-new", bytes),
    });

    const stageCalls = mockedInvoke.mock.calls.filter(
      ([cmd]) => cmd === desktopCommandChannels.workspace.stageAssetRaw,
    );
    expect(stageCalls).toHaveLength(0);
    expect(mockedInvoke).toHaveBeenLastCalledWith(
      desktopCommandChannels.workspace.commitStagedAutosave,
      expect.objectContaining({ assets: [{ sourceToken: "tok-from-load" }] }),
    );
  });

  it("rejects mismatched manifest and asset array lengths", async () => {
    const bytes = new Uint8Array([1, 2]);
    const payload = buildPayload("uuid-1", bytes);
    payload.assets.push({
      id: "uuid-extra",
      path: "assets/extra.png",
      fileName: "extra.png",
      mimeType: "image/png",
      buffer: bytes.slice().buffer,
    });

    await expect(
      saveStagedAutosave({ userId: null, payload }),
    ).rejects.toThrow("Workspace manifest and staged asset counts do not match.");
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("does not cache staged token when reading the staged asset fails", async () => {
    const bytes = new Uint8Array([4, 3, 2, 1]);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const expectedSha = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const payload = buildPayload("uuid-fail", bytes);

    mockedInvoke
      .mockResolvedValueOnce({
        found: true,
        path: "C:/autosave.koma",
        manifest: payload.manifest,
        assets: [
          {
            id: "uuid-fail",
            path: "assets/uuid-fail.png",
            fileName: "page.png",
            mimeType: "image/png",
            byteLength: 4,
            sourceToken: "tok-poison",
            sha256: expectedSha,
          },
        ],
      })
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValueOnce({
        sourceToken: "tok-fresh",
        sha256: expectedSha,
        byteLength: 4,
      })
      .mockResolvedValueOnce({ saved: true, path: "C:/autosave.koma" });

    await expect(loadStagedAutosave("user-1")).rejects.toThrow("read failed");
    await saveStagedAutosave({
      userId: "user-1",
      payload: buildPayload("uuid-next", bytes),
    });

    const stageCalls = mockedInvoke.mock.calls.filter(
      ([cmd]) => cmd === desktopCommandChannels.workspace.stageAssetRaw,
    );
    expect(stageCalls).toHaveLength(1);
    expect(mockedInvoke).toHaveBeenLastCalledWith(
      desktopCommandChannels.workspace.commitStagedAutosave,
      expect.objectContaining({ assets: [{ sourceToken: "tok-fresh" }] }),
    );
  });
});
