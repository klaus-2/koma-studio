// Inline text editor (double-click editing) for RenderTextPreview.
// The dock pointer-state effect logically belongs to the type dock cluster
// but sits here so the hook order stays stable.

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import type React from 'react';
import type {
  AioTextRegion,
  TranslationNoteOverlayConfig,
} from '../../../types/dashboard.types';
import type { RenderTextStyleRange } from '../../../typography/renderStyle';
import type { RenderTextStyle } from '../../../typography/renderStyle';
import { cloneRenderStyle } from '../../../utils/dashboard.utils';
import {
  applyInlineRenderTextStylePatch,
  cloneRenderTextStyleRanges,
  remapRenderTextStyleRangesAfterTextEdit,
} from '../../../utils/renderTextStyleRanges';
import { restoreContentEditableSelection } from './inlineEditorSelection';
import type { RenderTextPreviewContextMenuState } from './RenderTextPreviewContextMenu';

export interface RenderTextPreviewInlineEditorState {
  regionId: string;
  value: string;
  originalValue: string;
  sessionOriginalValue: string;
  sessionOriginalStyleRanges?: RenderTextStyleRange[];
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
  updateRegionText: (
    regionId: string,
    nextText: string,
    nextStyleRanges?: RenderTextStyleRange[] | null,
  ) => void;
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

  const isComposingRef = useRef(false);
  const [compositionStyleRevision, refreshCompositionStyles] = useReducer(
    (revision: number) => revision + 1,
    0,
  );

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
      isComposingRef.current = false;
      const pendingDraft = pendingDraftRef.current;
      const pendingSameRegionText =
        pendingDraft && pendingDraft.regionId === region.id
          ? pendingDraft.value
          : null;
      const initialText = pendingSameRegionText ?? (region.renderText ?? '');
      const initialStyleRanges = cloneRenderTextStyleRanges(
        region.renderTextStyleRanges,
      );
      commitPendingInlineEditorDraft();
      onSelectRegion(region.id);
      setContextMenu(null);
      setInlineEditor({
        regionId: region.id,
        value: initialText,
        originalValue: initialText,
        sessionOriginalValue: initialText,
        sessionOriginalStyleRanges: initialStyleRanges,
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
    isComposingRef.current = false;
    savedSelectionRef.current = null;
    isPickerOpenRef.current = false;
    // The one terminal store commit for the whole typing session.
    commitPendingInlineEditorDraft();
    setInlineEditor(null);
  }, [commitPendingInlineEditorDraft, inlineEditor, setInlineEditor]);

  const cancelInlineEditor = useCallback(() => {
    if (!inlineEditor) return;
    isComposingRef.current = false;
    savedSelectionRef.current = null;
    isPickerOpenRef.current = false;
    // Escape reverts the whole session, even if formatting flushed the draft
    // to the store mid-edit.
    pendingDraftRef.current = null;
    const parentId = getTranslationNoteOverlayParentId(inlineEditor.regionId);
    updateRegions((region) => {
      if (!parentId) {
        if (region.id !== inlineEditor.regionId) return region;
        return {
          ...region,
          renderText: inlineEditor.sessionOriginalValue,
          renderTextStyleRanges: cloneRenderTextStyleRanges(
            inlineEditor.sessionOriginalStyleRanges,
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
          renderText: inlineEditor.sessionOriginalValue,
          renderTextStyleRanges: cloneRenderTextStyleRanges(
            inlineEditor.sessionOriginalStyleRanges,
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

  const applyInlineEditorDraftStyle = useCallback(
    (
      start: number,
      end: number,
      patch: Partial<RenderTextStyle>,
    ) => {
      if (!inlineEditor) return false;
      if (inlineEditor.value === inlineEditor.originalValue) return false;
      const editedRegion = displayRegionsWithDefaults.find(
        (region) => region.id === inlineEditor.regionId,
      );
      const baseStyle = cloneRenderStyle(
        editedRegion?.renderStyle ?? fallbackStyle,
      );
      // Draft ranges are derived from the region's ranges remapped onto the
      // draft text (see buildInlineEditorTextDraft).
      const draftStyleRanges = remapRenderTextStyleRangesAfterTextEdit(
        inlineEditor.originalValue,
        inlineEditor.value,
        baseStyle,
        editedRegion?.renderTextStyleRanges,
      );
      const nextRanges = applyInlineRenderTextStylePatch(
        inlineEditor.value,
        baseStyle,
        draftStyleRanges,
        start,
        end,
        patch,
      );
      updateRegionTextRef.current(
        inlineEditor.regionId,
        inlineEditor.value,
        nextRanges ?? null,
      );
      pendingDraftRef.current = null;
      setInlineEditor((prev) =>
        prev && prev.regionId === inlineEditor.regionId
          ? {
            ...prev,
            originalValue: inlineEditor.value,
            isDirty: false,
          }
          : prev,
      );
      return true;
    },
    [
      displayRegionsWithDefaults,
      fallbackStyle,
      inlineEditor,
      setInlineEditor,
    ],
  );

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

  const setInlineEditorSelection = useCallback(
    (start: number, end: number) => {
      if (!inlineEditor) return;
      const node = inlineEditorContentEditableRef.current;
      if (!node) return;
      const length = inlineEditor.value.length;
      const selectionStart = Math.max(0, Math.min(length, Math.floor(start)));
      const selectionEnd = Math.max(0, Math.min(length, Math.floor(end)));
      node.focus();
      restoreContentEditableSelection(node, selectionStart, selectionEnd);
      setInlineEditor((prev) =>
        prev
          ? { ...prev, selectionStart, selectionEnd }
          : prev,
      );
    },
    [inlineEditor, setInlineEditor],
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
    }
    return savedSelectionRef.current;
  }, [getInlineEditorSelection]);

  const clearPickerState = useCallback(() => {
    isPickerOpenRef.current = false;
    savedSelectionRef.current = null;
  }, []);

  const beginComposition = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const endComposition = useCallback(() => {
    isComposingRef.current = false;
    refreshCompositionStyles();
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
    isComposingRef.current = false;
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
    beginComposition,
    endComposition,
    isComposingRef,
    compositionStyleRevision,
    setInlineEditorSelection,
    applyInlineEditorDraftStyle,
  };
};
