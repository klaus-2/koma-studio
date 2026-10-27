// Regions the canvas paints: display regions with the live drag box applied
// and the inline editor draft (text + derived style ranges) on top.

import { useMemo } from 'react';
import type {
  AioTextRegion,
  RenderOverlayInteraction,
} from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  applyInlineEditorTextDraft,
  buildInlineEditorTextDraft,
} from '../../../utils/inlineEditor';
import type { InlineEditorDraftSource } from '../../../utils/inlineEditor';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';

interface UseRenderTextPreviewCanvasRegionsParams {
  displayRegionsWithDefaults: readonly AioTextRegion[];
  interaction: RenderOverlayInteraction | null;
  inlineEditor: RenderTextPreviewInlineEditorState | null;
  fallbackStyle: RenderTextStyle;
}

export const useRenderTextPreviewCanvasRegions = ({
  displayRegionsWithDefaults,
  interaction,
  inlineEditor,
  fallbackStyle,
}: UseRenderTextPreviewCanvasRegionsParams): readonly AioTextRegion[] => {
  const paintedRegions = useMemo(() => {
    if (interaction?.kind === 'move' && interaction.currentBox) {
      const currentBox = interaction.currentBox;
      const dragged = displayRegionsWithDefaults.find(
        (region) => region.id === interaction.regionId,
      );
      if (dragged) {
        return displayRegionsWithDefaults.map((region) =>
          region === dragged ? { ...region, bbox: currentBox } : region,
        );
      }
    }
    return displayRegionsWithDefaults;
  }, [displayRegionsWithDefaults, interaction]);

  // Only the draft inputs are memoized: caret and drag-selection moves change
  // the editor state identity but not the painted text, so the canvas keeps
  // its last frame (selection lives in the DOM editor, never on this canvas).
  const draftRegionId = inlineEditor?.regionId ?? null;
  const draftValue = inlineEditor?.value ?? null;
  const draftOriginalValue = inlineEditor?.originalValue ?? null;
  const draftSource = useMemo<InlineEditorDraftSource | null>(
    () =>
      draftRegionId !== null && draftValue !== null && draftOriginalValue !== null
        ? {
          regionId: draftRegionId,
          value: draftValue,
          originalValue: draftOriginalValue,
        }
        : null,
    [draftOriginalValue, draftRegionId, draftValue],
  );
  const draft = useMemo(
    () => buildInlineEditorTextDraft(draftSource, paintedRegions, fallbackStyle),
    [draftSource, fallbackStyle, paintedRegions],
  );
  return useMemo(
    () => applyInlineEditorTextDraft(paintedRegions, draft),
    [draft, paintedRegions],
  );
};
