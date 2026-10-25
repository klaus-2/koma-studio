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
}: UseRenderTextPreviewCanvasRegionsParams): readonly AioTextRegion[] =>
  useMemo(() => {
    let paintedRegions: readonly AioTextRegion[] = displayRegionsWithDefaults;
    if (interaction?.kind === 'move' && interaction.currentBox) {
      const currentBox = interaction.currentBox;
      const dragged = displayRegionsWithDefaults.find(
        (region) => region.id === interaction.regionId,
      );
      if (dragged) {
        paintedRegions = displayRegionsWithDefaults.map((region) =>
          region === dragged ? { ...region, bbox: currentBox } : region,
        );
      }
    }
    return applyInlineEditorTextDraft(
      paintedRegions,
      buildInlineEditorTextDraft(inlineEditor, paintedRegions, fallbackStyle),
    );
  }, [
    displayRegionsWithDefaults,
    fallbackStyle,
    inlineEditor,
    interaction,
  ]);
