import type { WorkspaceStitchStateDocument } from "../../../../../types/src/workspace";
import { jsonSafeClone } from "../../../workspace/jsonSafeClone";

/**
 * Stitch workspace document codec — colocated with the stitch types. The
 * stitch state is 11 plain JSON-safe fields, so both directions are a deep
 * JSON-safe clone of the whole group; the codec exists so the serialization
 * layer does not need to know the stitch group at all.
 */
export const stitchWorkspaceCodec = {
  toDocument(state: WorkspaceStitchStateDocument): WorkspaceStitchStateDocument {
    return jsonSafeClone(state);
  },
  toRuntime(document: WorkspaceStitchStateDocument): WorkspaceStitchStateDocument {
    return jsonSafeClone(document);
  },
};
