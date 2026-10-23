// Inline text editor (double-click editing) for RenderTextPreview.
// Moved verbatim from RenderTextPreview.tsx (T07 split); hook order preserved.
// Note: the dock pointer-state effect logically belongs to the type dock
// cluster but sits here to preserve the original hook order.

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type React from 'react';
import type {
  AioTextRegion,
  TranslationNoteOverlayConfig,
} from '../../../types/dashboard.types';
import type { RenderTextStyleRange } from '../../../typography/renderStyle';
import type { RenderTextStyle } from '../../../typography/renderStyle';
import { cloneRenderStyle } from '../../../utils/dashboard.utils';
import {
  cloneRenderTextStyleRanges,
} from '../../../utils/renderTextStyleRanges';
import {
  buildInlineEditorRuns,
  readInlineEditorPlainText,
} from '../../../utils/inlineEditor';
import { restoreContentEditableSelection } from './inlineEditorSelection';
import type { RenderTextPreviewContextMenuState } from './RenderTextPreviewContextMenu';

export interface RenderTextPreviewInlineEditorState {
  regionId: string;
  value: string;
  originalValue: string;
  originalStyleRanges?: RenderTextStyleRange[];
  isDirty: boolean;
  selectionStart: number;
  selectionEnd: number;
}

interface UseRenderTextPreviewInlineEditorParams {
  inlineEditor: RenderTextPreviewInlineEditorState | null;
  setInlineEditor: React.Dispatch<
    React.SetStateAction<RenderTextPreviewInlineEditorState | null>
  >;
  setContextMenu: React.Dispatch<
    React.SetStateAction<RenderTextPreviewContextMenuState | null>
  >;
  inlineEditorContentEditableRef: React.RefObject<HTMLDivElement | null>;
  savedSelectionRef: React.RefObject<{ start: number; end: number } | null>;
  isPickerOpenRef: React.RefObject<boolean>;
  dockPointerDownRef: React.RefObject<boolean>;
  displayRegionsWithDefaults: AioTextRegion[];
  fallbackStyle: RenderTextStyle;
  editable: boolean;
  renderStageActive: boolean;
  areaSelectionEnabled: boolean;
  onSelectRegion: (regionId: string | null) => void;
  updateRegionText: (regionId: string, nextText: string) => void;
  updateRegions: (updater: (region: AioTextRegion) => AioTextRegion) => void;
  getTranslationNoteOverlayParentId: (regionId: string) => string | null;
  resolveTranslationNoteOverlayConfig: (
    region: AioTextRegion,
  ) => TranslationNoteOverlayConfig | null;
}

export const useRenderTextPreviewInlineEditor = ({
  inlineEditor,
  setInlineEditor,
  setContextMenu,
  inlineEditorContentEditableRef,
  savedSelectionRef,
  isPickerOpenRef,
  dockPointerDownRef,
  displayRegionsWithDefaults,
  fallbackStyle,
  editable,
  renderStageActive,
  areaSelectionEnabled,
  onSelectRegion,
  updateRegionText,
  updateRegions,
  getTranslationNoteOverlayParentId,
  resolveTranslationNoteOverlayConfig,
}: UseRenderTextPreviewInlineEditorParams) => {
  // keystrokes stay in the local draft (pendingDraftRef + editor state);
  const pendingDraftRef = useRef<{
    regionId: string;
    value: string;
  } | null>(null);
  const updateRegionTextRef = useRef(updateRegionText);
  useEffect(() => {
    updateRegionTextRef.current = updateRegionText;
  }, [updateRegionText]);

  const lastStyledRangesKeyRef = useRef<string | null>(null);

  const commitPendingInlineEditorDraft = useCallback(() => {
    const pending = pendingDraftRef.current;
    if (!pending) return;
    pendingDraftRef.current = null;
    updateRegionTextRef.current(pending.regionId, pending.value);
  }, []);

  const restoreInlineEditorSelection = useCallback(() => {
    if (!inlineEditor) return;
    requestAnimationFrame(() => {
      const node = inlineEditorContentEditableRef.current;
      if (!node) return;
      node.focus();
      restoreContentEditableSelection(
        node,
        inlineEditor.selectionStart,
        inlineEditor.selectionEnd,
      );
    });
  }, [inlineEditor]);

  const openInlineEditorForRegion = useCallback(
    (region: AioTextRegion) => {
      if (!editable || !renderStageActive) return;
      const pendingDraft = pendingDraftRef.current;
      const pendingSameRegionText =
        pendingDraft && pendingDraft.regionId === region.id
          ? pendingDraft.value
          : null;
      const initialText = pendingSameRegionText ?? (region.renderText ?? '');
      commitPendingInlineEditorDraft();
      onSelectRegion(region.id);
      setContextMenu(null);
      setInlineEditor({
        regionId: region.id,
        value: initialText,
        originalValue: initialText,
        originalStyleRanges: cloneRenderTextStyleRanges(
          region.renderTextStyleRanges,
        ),
        isDirty: false,
        selectionStart: initialText.length,
        selectionEnd: initialText.length,
      });
    },
    [
      commitPendingInlineEditorDraft,
      editable,
      onSelectRegion,
      renderStageActive,
    ],
  );

  const saveInlineEditor = useCallback(() => {
    if (!inlineEditor) return;
    savedSelectionRef.current = null;
    isPickerOpenRef.current = false;
    // The one terminal store commit for the whole typing session.
    commitPendingInlineEditorDraft();
    setInlineEditor(null);
  }, [commitPendingInlineEditorDraft, inlineEditor, setInlineEditor]);

  const cancelInlineEditor = useCallback(() => {
    if (!inlineEditor) return;
    savedSelectionRef.current = null;
    isPickerOpenRef.current = false;
    // Escape reverts: drop the draft (store still holds originalValue, which
    // the updateRegions write below re-commits as the revert).
    pendingDraftRef.current = null;
    const parentId = getTranslationNoteOverlayParentId(inlineEditor.regionId);
    updateRegions((region) => {
      if (!parentId) {
        if (region.id !== inlineEditor.regionId) return region;
        return {
          ...region,
          renderText: inlineEditor.originalValue,
          renderTextStyleRanges: cloneRenderTextStyleRanges(
            inlineEditor.originalStyleRanges,
          ),
        };
      }
      if (region.id !== parentId) return region;
      const overlay = resolveTranslationNoteOverlayConfig(region);
      if (!overlay) return region;
      return {
        ...region,
        translationNoteOverlay: {
          ...overlay,
          renderText: inlineEditor.originalValue,
          renderTextStyleRanges: cloneRenderTextStyleRanges(
            inlineEditor.originalStyleRanges,
          ),
        },
      };
    });
    setInlineEditor(null);
  }, [
    getTranslationNoteOverlayParentId,
    inlineEditor,
    resolveTranslationNoteOverlayConfig,
    updateRegions,
  ]);

  const handleInlineEditorInput = useCallback(
    (nextValue: string) => {
      if (!inlineEditor) return;
      if (nextValue === inlineEditor.originalValue) {
        pendingDraftRef.current = null;
      } else {
        pendingDraftRef.current = {
          regionId: inlineEditor.regionId,
          value: nextValue,
        };
      }
      setInlineEditor((prev) =>
        prev
          ? {
            ...prev,
            value: nextValue,
            isDirty: nextValue !== prev.originalValue,
          }
          : prev,
      );
    },
    [inlineEditor],
  );

  const getInlineEditorSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const contentEditable = inlineEditorContentEditableRef.current;
    if (!contentEditable || !contentEditable.contains(range.startContainer)) return null;

    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(contentEditable);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;
    return { start, end };
  }, []);

  const syncInlineEditorSelection = useCallback(() => {
    const selection = getInlineEditorSelection();
    if (!selection) return;

    // Don't clear saved selection while picker is open
    if (!isPickerOpenRef.current) {
      savedSelectionRef.current = null;
    } else {
    }

    setInlineEditor((prev) =>
      prev
        ? {
          ...prev,
          selectionStart: Math.min(selection.start, prev.value.length),
          selectionEnd: Math.min(selection.end, prev.value.length),
        }
        : prev,
    );
  }, [getInlineEditorSelection]);

  const saveCurrentSelection = useCallback(() => {
    const selection = getInlineEditorSelection();
    isPickerOpenRef.current = true;
    if (selection && selection.start !== selection.end) {
      savedSelectionRef.current = selection;
    } else {
    }
    return savedSelectionRef.current;
  }, [getInlineEditorSelection]);

  const clearPickerState = useCallback(() => {
    isPickerOpenRef.current = false;
    savedSelectionRef.current = null;
  }, []);

  useEffect(() => {
    if (!inlineEditor) return;
    const exists = displayRegionsWithDefaults.some(
      (region) => region.id === inlineEditor.regionId,
    );
    if (!exists) {
      pendingDraftRef.current = null;
      setInlineEditor(null);
    }
  }, [displayRegionsWithDefaults, inlineEditor]);

  useEffect(() => {
    if (!inlineEditor) return;
    if (!editable || !renderStageActive || !areaSelectionEnabled) {
      commitPendingInlineEditorDraft();
      setInlineEditor(null);
    }
  }, [
    areaSelectionEnabled,
    commitPendingInlineEditorDraft,
    editable,
    inlineEditor,
    renderStageActive,
    setInlineEditor,
  ]);

  useEffect(
    () => () => {
      commitPendingInlineEditorDraft();
    },
    [commitPendingInlineEditorDraft],
  );

  const closeInlineEditor = useCallback(() => {
    commitPendingInlineEditorDraft();
    setInlineEditor(null);
  }, [commitPendingInlineEditorDraft, setInlineEditor]);

  useEffect(() => {
    if (!inlineEditor) return;
    requestAnimationFrame(() => {
      const node = inlineEditorContentEditableRef.current;
      if (!node) return;
      node.focus();
      restoreContentEditableSelection(
        node,
        inlineEditor.selectionStart,
        inlineEditor.selectionEnd,
      );
    });
  }, [
    inlineEditor?.regionId,
  ]);

  useLayoutEffect(() => {
    if (!inlineEditor) return;
    const node = inlineEditorContentEditableRef.current;
    if (!node) return;

    const editedRegion =
      displayRegionsWithDefaults.find(
        (region) => region.id === inlineEditor.regionId,
      ) ?? null;
    const ranges = editedRegion?.renderTextStyleRanges ?? null;
    // Keyed so a style change rebuilds the spans even though the text matches.
    const rangesKey = JSON.stringify(ranges ?? null);
    const currentValue = readInlineEditorPlainText(node);
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
      span.style.fontWeight = run.fontWeight;
      span.style.fontStyle = run.fontStyle;
      span.style.textDecoration = run.textDecoration;
      span.style.textTransform = run.textTransform;
      span.style.color = run.color;
      span.style.textShadow = run.textShadow;
      return span;
    });
    node.replaceChildren(...spans);
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
    displayRegionsWithDefaults,
    fallbackStyle,
    inlineEditor?.regionId,
    inlineEditor?.selectionEnd,
    inlineEditor?.selectionStart,
    inlineEditor?.value,
    restoreContentEditableSelection,
  ]);

  useEffect(() => {
    const clearDockPointerState = () => {
      dockPointerDownRef.current = false;
    };
    window.addEventListener('pointerup', clearDockPointerState);
    window.addEventListener('pointercancel', clearDockPointerState);
    return () => {
      window.removeEventListener('pointerup', clearDockPointerState);
      window.removeEventListener('pointercancel', clearDockPointerState);
    };
  }, []);

  return {
    restoreInlineEditorSelection,
    openInlineEditorForRegion,
    saveInlineEditor,
    cancelInlineEditor,
    handleInlineEditorInput,
    closeInlineEditor,
    getInlineEditorSelection,
    syncInlineEditorSelection,
    saveCurrentSelection,
    clearPickerState,
  };
};
