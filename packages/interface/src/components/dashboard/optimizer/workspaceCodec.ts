import type {
  WorkspaceOptimizerStateDocument,
} from "../../../../../types/src/workspace";
import { jsonSafeClone } from "../../../workspace/jsonSafeClone";
import type { OptimizerWorkspaceRuntimeState } from "../../../workspace/workspaceUtilityRuntimeStates";
import type { WorkspaceCodecAssetSink, WorkspaceCodecAssetSource } from "../watermark/workspaceCodec";

/**
 * Optimizer workspace document codec — colocated with the optimizer types.
 * Owns the optimizer field knowledge (recipe/selectedPreset/results) that
 * used to live in dashboardWorkspace.serialization.ts. The asset sink/source
 * interfaces are shared with the watermark codec (same structural contract).
 *
 * BEHAVIOR CHANGE (blank-keep canonical): toRuntime emits previewUrl: "" for
 * restored results — the derived previewUrl is never captured, and the
 * restored value now matches the history variant's blank-keep instead of the
 * key being dropped.
 */

const toOptimizerResultDocument = async (
  sink: WorkspaceCodecAssetSink,
  item: OptimizerWorkspaceRuntimeState["results"][number],
) => ({
  sourceImageId: item.sourceImageId,
  fileName: item.fileName,
  originalBytes: item.originalBytes,
  optimizedBytes: item.optimizedBytes,
  width: item.width,
  height: item.height,
  blob: await sink.addBlob("optimizer-results", item.fileName, item.blob),
});

export const optimizerWorkspaceCodec = {
  async toDocument(
    state: OptimizerWorkspaceRuntimeState,
    sink: WorkspaceCodecAssetSink,
  ): Promise<WorkspaceOptimizerStateDocument> {
    const results = await Promise.all(
      state.results.map((item) => toOptimizerResultDocument(sink, item)),
    );
    return {
      recipe: jsonSafeClone(state.recipe),
      selectedPreset: state.selectedPreset,
      activeImageId: state.activeImageId,
      results,
    };
  },
  toRuntime(
    document: WorkspaceOptimizerStateDocument,
    source: WorkspaceCodecAssetSource,
  ): OptimizerWorkspaceRuntimeState {
    return {
      recipe: jsonSafeClone(document.recipe),
      selectedPreset: document.selectedPreset,
      activeImageId: document.activeImageId,
      results: document.results.map((item) => ({
        sourceImageId: item.sourceImageId,
        fileName: item.fileName,
        blob: source.resolveBlob(item.blob.assetId),
        originalBytes: item.originalBytes,
        optimizedBytes: item.optimizedBytes,
        width: item.width,
        height: item.height,
        previewUrl: "",
      })),
    };
  },
};
