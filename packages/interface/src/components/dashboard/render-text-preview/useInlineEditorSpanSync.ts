// Rebuilds the contentEditable's flat DOM from the draft so Range offsets
// stay aligned with it; native-selection mode also gets per-run formatting
// spans. Runs as a layout effect so the DOM matches the draft before paint.

import { useLayoutEffect, useRef } from 'react';
import type React from 'react';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { cloneRenderStyle } from '../../../utils/dashboard.utils';
import {
  buildInlineEditorRuns,
  normalizeInlineEditorPlainText,
  readInlineEditorPlainText,
} from '../../../utils/inlineEditor';
import {
  restoreContentEditableSelection,
  syncTrailingLineBreak,
} from './inlineEditorSelection';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';

interface UseInlineEditorSpanSyncParams {
  inlineEditor: RenderTextPreviewInlineEditorState | null;
  /** True when selection is drawn by the overlay instead of the browser. */
  canvasSelection: boolean;
  isComposingRef: React.RefObject<boolean>;
  compositionStyleRevision: number;
  contentEditableRef: React.RefObject<HTMLDivElement | null>;
  displayRegionsWithDefaults: AioTextRegion[];
  fallbackStyle: RenderTextStyle;
  inlineEditorDisplayScale: number;
}

export const useInlineEditorSpanSync = ({
  inlineEditor,
  canvasSelection,
  isComposingRef,
  compositionStyleRevision,
  contentEditableRef,
  displayRegionsWithDefaults,
  fallbackStyle,
  inlineEditorDisplayScale,
}: UseInlineEditorSpanSyncParams): void => {
  const lastStyledRangesKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!inlineEditor) return;
    const node = contentEditableRef.current;
    if (!node) return;
    if (isComposingRef.current) {
      // Never replace the spans while the IME owns the composition range.
      lastStyledRangesKeyRef.current = null;
      return;
    }

    const editedRegion =
      displayRegionsWithDefaults.find(
        (region) => region.id === inlineEditor.regionId,
      ) ?? null;
    const ranges = editedRegion?.renderTextStyleRanges ?? null;
    // Keyed so a style change rebuilds the spans even though the text matches.
    const rangesKey = JSON.stringify(ranges ?? null);
    // Canvas-selection mode keeps a flat DOM whose text nodes carry the
    // newlines, so textContent is the draft and Range offsets match it.
    const currentValue = canvasSelection
      ? normalizeInlineEditorPlainText(node.textContent ?? '')
      : readInlineEditorPlainText(node);
    if (
      currentValue === inlineEditor.value
      && lastStyledRangesKeyRef.current === rangesKey
    ) {
      return;
    }
    lastStyledRangesKeyRef.current = rangesKey;

    const baseStyle = cloneRenderStyle(
      editedRegion?.renderStyle ?? fallbackStyle,
    );
    const spans = buildInlineEditorRuns(
      inlineEditor.value,
      ranges,
      baseStyle,
    ).map((run) => {
      const span = document.createElement('span');
      span.textContent = run.text;
      span.style.fontFamily = run.fontFamily;
      if (run.fontSize !== undefined) {
        span.style.fontSize = `${run.fontSize * inlineEditorDisplayScale}px`;
      }
      span.style.fontWeight = run.fontWeight;
      span.style.fontStyle = run.fontStyle;
      span.style.textDecoration = run.textDecoration;
      span.style.textTransform = run.textTransform;
      return span;
    });
    node.replaceChildren(...spans);
    if (canvasSelection) {
      syncTrailingLineBreak(node);
    }
    if (
      document.activeElement === node
      || node.contains(document.activeElement)
    ) {
      restoreContentEditableSelection(
        node,
        inlineEditor.selectionStart,
        inlineEditor.selectionEnd,
      );
    }
  }, [
    canvasSelection,
    compositionStyleRevision,
    contentEditableRef,
    displayRegionsWithDefaults,
    fallbackStyle,
    inlineEditor?.regionId,
    inlineEditor?.selectionEnd,
    inlineEditor?.selectionStart,
    inlineEditor?.value,
    inlineEditorDisplayScale,
    isComposingRef,
  ]);
};
