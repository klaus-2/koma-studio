import type {
  WorkspaceAssetRef,
  WorkspaceWatermarkStateDocument,
} from "../../../../../types/src/workspace";
import { jsonSafeClone } from "../../../workspace/jsonSafeClone";
import type { WatermarkWorkspaceRuntimeState } from "../../../workspace/workspaceUtilityRuntimeStates";

/**
 * Watermark workspace document codec — colocated with the watermark types.
 * Owns the watermark field knowledge (draft/compare/presets/source file/
 * results) that used to live in dashboardWorkspace.serialization.ts.
 *
 * The asset plumbing stays in the serialization layer and is injected:
 * - toDocument collects binaries through a minimal asset sink.
 * - toRuntime resolves document asset refs through a minimal asset source.
 */

export interface WorkspaceCodecAssetSink {
  readonly addFile: (namespace: string, file: File) => Promise<{ assetId: string }>;
  readonly addBlob: (namespace: string, fileName: string, blob: Blob) => Promise<{ assetId: string }>;
}

export interface WorkspaceCodecAssetSource {
  readonly resolveFile: (assetId: string) => File;
  readonly resolveBlob: (assetId: string) => Blob;
}

const toWatermarkResultDocument = async (
  sink: WorkspaceCodecAssetSink,
  item: WatermarkWorkspaceRuntimeState["results"][number],
): Promise<{ sourceImageId: string; name: string; resolvedAnchor: string; blob: WorkspaceAssetRef }> => {
  const blob = await sink.addBlob("watermark-results", item.name, item.blob);
  return {
    sourceImageId: item.sourceImageId,
    name: item.name,
    resolvedAnchor: item.resolvedAnchor,
    blob,
  };
};

export const watermarkWorkspaceCodec = {
  async toDocument(
    state: WatermarkWorkspaceRuntimeState,
    sink: WorkspaceCodecAssetSink,
  ): Promise<WorkspaceWatermarkStateDocument> {
    const watermarkImage = state.watermarkImageFile
      ? await sink.addFile("watermark-source", state.watermarkImageFile)
      : null;
    const results = await Promise.all(
      state.results.map((item) => toWatermarkResultDocument(sink, item)),
    );
    return {
      draft: jsonSafeClone(state.draft),
      activeImageId: state.activeImageId,
      compareMode: state.compareMode,
      compareValue: state.compareValue,
      selectedPresetId: state.selectedPresetId,
      autoSuggestion: state.autoSuggestion,
      userPresets: jsonSafeClone(state.userPresets),
      watermarkImage,
      results,
      textZoneCache: jsonSafeClone(state.textZoneCache ?? {}),
    };
  },
  async toRuntime(
    document: WorkspaceWatermarkStateDocument,
    source: WorkspaceCodecAssetSource,
  ): Promise<WatermarkWorkspaceRuntimeState> {
    const results: WatermarkWorkspaceRuntimeState["results"] = [];
    for (const item of document.results) {
      const blob = source.resolveBlob(item.blob.assetId);
      // Owned by the restored watermark registry; revoked when the entry is
      // replaced or removed (revokeEntries).
      const previewUrl = URL.createObjectURL(blob);
      results.push({
        sourceImageId: item.sourceImageId,
        name: item.name,
        blob,
        previewUrl,
        resolvedAnchor: item.resolvedAnchor,
      });
    }
    return {
      draft: jsonSafeClone(document.draft),
      activeImageId: document.activeImageId,
      compareMode: document.compareMode,
      compareValue: document.compareValue,
      selectedPresetId: document.selectedPresetId,
      autoSuggestion: document.autoSuggestion,
      userPresets: jsonSafeClone(document.userPresets),
      watermarkImageFile: document.watermarkImage
        ? source.resolveFile(document.watermarkImage.assetId)
        : null,
      results,
      textZoneCache: document.textZoneCache ?? {},
    };
  },
};
