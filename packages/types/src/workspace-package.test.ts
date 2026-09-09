import test from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";

import {
  WORKSPACE_DOCUMENT_VERSION,
  type WorkspacePackagePayload,
} from "./workspace.ts";
import {
  buildWorkspacePackageZip,
  parseWorkspacePackageZip,
} from "./workspace-package.ts";

const createPackagePayload = (): WorkspacePackagePayload => {
  const buffer = new TextEncoder().encode("hello workspace").buffer;
  return {
    manifest: {
      packageVersion: 1,
      exportedAt: "2026-03-17T00:00:00.000Z",
      app: "koma-studio",
      documentVersion: WORKSPACE_DOCUMENT_VERSION,
      document: {
        version: WORKSPACE_DOCUMENT_VERSION,
        savedAt: "2026-03-17T00:00:00.000Z",
        autosaveScope: "guest",
        autosaveUserId: null,
        view: {
          mode: "aio",
          subMode: "manual",
          activeImageId: "img-1",
          viewMode: "long_strip",
          translatorWorkspaceMode: "visual",
        },
        footer: {
          lastActionScope: "aio",
          statusMessage: "ok",
        },
        images: [],
        downloadItems: [],
        batchThreadsEnabled: true,
        batchThreads: 2,
        aio: {
          steps: {},
          stageSelection: {},
          presetState: {},
          maskDilation: 5,
          hdStrategy: "resize",
          hdResizeLimit: 960,
          hdCropMargin: 512,
          hdCropTriggerSize: 512,
          detectionsByImage: {},
          selectedRegionByImage: {},
          pipelineSnapshots: [],
          pipelineSnapshotIndex: -1,
          imageSnapshotIndexById: {},
          autoHistoryAvailable: false,
          autoProcessedImageById: {},
          manualQuotaChargedByImage: {},
          manualProgressByImage: {},
          manualImageEditsByImage: {},
        },
        cleaner: {
          detectionsByImage: {},
          selectedRegionByImage: {},
          processedBaseAssetByImage: {},
          runMetaByImage: {},
          manualImageEditsByImage: {},
        },
        translator: {
          srcLang: "ja",
          tgtLang: "pt-br",
          aioSrcLang: "ja",
          aioTgtLang: "pt-br",
          translatorDraftText: "",
          translatorTranslatedText: "",
          translatorLastTextModelUsed: null,
          translatorTextDirty: false,
          translatorDetectionsByImage: {},
          translatorSelectedRegionByImage: {},
          translatorRunMetaByImage: {},
        },
        typesetter: {
          selectionTool: "select",
          queueSelectedId: null,
          snapshotName: "",
          selectedSnapshotId: null,
          sessionsByImage: {},
        },
        enhance: {
          scale: 2,
          profile: "manga_scan",
          modelId: "enhance",
          outputFormat: "png",
        },
        utility: {
          stitch: {
            stitchLayoutMode: "webtoon",
            stitchBatchStrategy: "fixed-count",
            stitchBatchSize: 3,
            stitchTargetPrimaryAxis: 12000,
            stitchGap: 0,
            stitchAlignMode: "center",
            stitchBackground: "#ffffff",
            stitchSingleExportFormat: "png",
            stitchFileBaseName: "koma-stitch",
            stitchSelectedBatchIndex: 0,
            stitchBatchIndexes: [],
          },
          splitter: {
            recipe: {},
            imageStates: {},
            activeImageId: null,
          },
          watermark: {
            draft: {},
            activeImageId: null,
            compareMode: "split",
            compareValue: 58,
            selectedPresetId: "",
            autoSuggestion: "",
            userPresets: [],
            watermarkImage: null,
            results: [],
          },
          optimizer: {
            recipe: {},
            selectedPreset: "web-light",
            activeImageId: null,
            results: [],
          },
        },
        llm: {
          llmSettings: {},
          customLlmProfiles: [],
          customLlmProfilesMode: "browser_local",
          pendingCustomSelections: {},
          customLlmDrafts: {},
          freeProviderDrafts: {},
        },
      },
      assets: [
        {
          id: "asset-1",
          path: "assets/test/asset-1-note.txt",
          fileName: "note.txt",
          mimeType: "text/plain",
          byteLength: buffer.byteLength,
        },
      ],
    },
    assets: [
      {
        id: "asset-1",
        path: "assets/test/asset-1-note.txt",
        fileName: "note.txt",
        mimeType: "text/plain",
        buffer,
      },
    ],
  };
};

test("buildWorkspacePackageZip / parseWorkspacePackageZip roundtrip", () => {
  const payload = createPackagePayload();
  const zipBytes = buildWorkspacePackageZip(payload);
  const parsed = parseWorkspacePackageZip(zipBytes);

  assert.equal(parsed.manifest.document.view.mode, "aio");
  assert.equal(parsed.assets.length, 1);
  assert.equal(parsed.assets[0]?.fileName, "note.txt");
  const text = new TextDecoder().decode(parsed.assets[0]?.buffer);
  assert.equal(text, "hello workspace");
});

test("parseWorkspacePackageZip rejects incompatible package version", () => {
  const incompatible = zipSync({
    "manifest.json": strToU8(JSON.stringify({
      packageVersion: 99,
      exportedAt: "2026-03-17T00:00:00.000Z",
      app: "koma-studio",
      documentVersion: WORKSPACE_DOCUMENT_VERSION,
      document: createPackagePayload().manifest.document,
      assets: [],
    })),
  });

  assert.throws(
    () => parseWorkspacePackageZip(incompatible),
    /Workspace incompatible/,
  );
});
