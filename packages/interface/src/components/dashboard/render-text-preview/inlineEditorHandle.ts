// Single definition of the InlineTextEditorHandle wiring shared by the
// classic and noir previews; the type dock's style updater provides the
// selection-aware bold/italic/underline toggle.

import type React from 'react';
import type { RenderTextStyle } from '../../../utils/renderText';
import type { InlineEditorLineBox } from '../../../utils/inlineEditorLayout';
import type { InlineTextEditorHandle } from './InlineTextEditorSurface';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';

interface BuildInlineEditorHandleParams {
  readonly inlineEditor: RenderTextPreviewInlineEditorState;
  readonly selection: Readonly<{
    contentEditableStyle: React.CSSProperties;
    lineBoxes: readonly InlineEditorLineBox[];
    caretColor: string;
    canvasSelection: boolean;
  }>;
  readonly refs: Readonly<{
    contentEditableRef: React.RefObject<HTMLDivElement | null>;
    dockRef: React.RefObject<HTMLDivElement | null>;
    dockPointerDownRef: React.RefObject<boolean>;
  }>;
  readonly actions: Readonly<{
    onInput: (nextValue: string) => void;
    syncSelection: () => void;
    cancel: () => void;
    save: () => void;
    /** Selection-aware region style updater from the type dock. */
    toggleRegionStyle: (
      updater: (style: RenderTextStyle) => RenderTextStyle,
    ) => void;
    setState: React.Dispatch<
      React.SetStateAction<RenderTextPreviewInlineEditorState | null>
    >;
    beginComposition: () => void;
    endComposition: () => void;
    setSelection: (start: number, end: number) => void;
  }>;
}

export const buildInlineEditorHandle = ({
  inlineEditor,
  selection,
  refs,
  actions,
}: BuildInlineEditorHandleParams): InlineTextEditorHandle => ({
  state: inlineEditor,
  contentEditableRef: refs.contentEditableRef,
  contentEditableStyle: selection.contentEditableStyle,
  onInput: actions.onInput,
  syncSelection: actions.syncSelection,
  cancel: actions.cancel,
  save: actions.save,
  toggleFormat: (kind) =>
    actions.toggleRegionStyle((style) => ({
      ...style,
      [kind]: !style[kind],
    })),
  setState: actions.setState,
  beginComposition: actions.beginComposition,
  endComposition: actions.endComposition,
  selectionLines: selection.lineBoxes,
  caretColor: selection.caretColor,
  canvasSelection: selection.canvasSelection,
  setSelection: actions.setSelection,
  dockPointerDownRef: refs.dockPointerDownRef,
  dockRef: refs.dockRef,
});
