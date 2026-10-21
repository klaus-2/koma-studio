import type { WorkspaceSplitterStateDocument } from "../../../../../types/src/workspace";
import { jsonSafeClone } from "../../../workspace/jsonSafeClone";
import type { SplitterWorkspaceRuntimeState } from "../../../workspace/workspaceUtilityRuntimeStates";

/**
 * Splitter workspace document codec — colocated with the splitter types.
 * Bridges the runtime workspace state and the persisted document group; the
 * splitter recipe/images are JSON-safe values cloned on both directions.
 */
export const splitterWorkspaceCodec = {
  toDocument(state: SplitterWorkspaceRuntimeState): WorkspaceSplitterStateDocument {
    return {
      recipe: jsonSafeClone(state.recipe),
      imageStates: jsonSafeClone(state.imageStates),
      activeImageId: state.activeImageId,
    };
  },
  toRuntime(document: WorkspaceSplitterStateDocument): SplitterWorkspaceRuntimeState {
    return {
      recipe: jsonSafeClone(document.recipe),
      imageStates: jsonSafeClone(document.imageStates),
      activeImageId: document.activeImageId,
    };
  },
};
