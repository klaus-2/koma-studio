import React, { useRef } from 'react';
import { useI18n } from '../../../i18n';
import { syncTrailingLineBreak } from './inlineEditorSelection';
import {
  normalizeInlineEditorPlainText,
  readInlineEditorPlainText,
  resolveInlineEditorWordRange,
} from '../../../utils/inlineEditor';
import {
  resolveInlineEditorOffsetFromPoint,
  type InlineEditorLineBox,
} from '../../../utils/inlineEditorLayout';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';

export interface InlineTextEditorHandle {
  state: RenderTextPreviewInlineEditorState;
  contentEditableRef: React.RefObject<HTMLDivElement | null>;
  contentEditableStyle: React.CSSProperties;
  onInput: (nextValue: string) => void;
  syncSelection: () => void;
  cancel: () => void;
  save: () => void;
  /**
   * Toggles bold/italic/underline through the region style pipeline; the
   * type dock applies it to the current selection when one exists and to
   * the whole region otherwise.
   */
  toggleFormat: (kind: 'bold' | 'italic' | 'underline') => void;
  setState: React.Dispatch<
    React.SetStateAction<RenderTextPreviewInlineEditorState | null>
  >;
  beginComposition: () => void;
  endComposition: () => void;
  selectionLines: readonly InlineEditorLineBox[];
  caretColor: string;
  canvasSelection: boolean;
  setSelection: (start: number, end: number) => void;
  dockPointerDownRef: React.RefObject<boolean>;
  dockRef: React.RefObject<HTMLDivElement | null>;
}

interface InlineTextEditorSurfaceProps {
  editor: InlineTextEditorHandle;
}

const syncEmptyState = (node: HTMLElement, value: string): void => {
  if (value.length > 0) {
    node.removeAttribute('data-empty');
  } else {
    node.setAttribute('data-empty', 'true');
  }
};

const InlineTextEditorSurface = ({ editor }: InlineTextEditorSurfaceProps) => {
  const { t } = useI18n();
  const dragAnchorRef = useRef<number | null>(null);

  const resolvePointerOffset = (
    event: Readonly<{ nativeEvent: MouseEvent }>,
  ): number | null => {
    const node = editor.contentEditableRef.current;
    if (!node || editor.selectionLines.length === 0) return null;
    const native = event.nativeEvent;
    const xFraction = native.offsetX / Math.max(1, node.clientWidth);
    const yFraction = native.offsetY / Math.max(1, node.clientHeight);
    return resolveInlineEditorOffsetFromPoint(
      editor.selectionLines,
      xFraction,
      yFraction,
      editor.state.value.length,
    );
  };

  // The canvas-selection editor keeps its DOM flat (text nodes plus an
  // optional trailing <br>), so textContent is the draft while Range offsets
  // stay aligned with it. Native fallback keeps innerText's block semantics.
  const readEditorValue = (node: HTMLElement): string =>
    editor.canvasSelection
      ? normalizeInlineEditorPlainText(node.textContent ?? '')
      : readInlineEditorPlainText(node);

  const insertPlainText = (text: string): void => {
    const node = editor.contentEditableRef.current;
    const selection = window.getSelection();
    if (!node || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const inserted = document.createTextNode(text);
    range.insertNode(inserted);
    range.setStartAfter(inserted);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    syncTrailingLineBreak(node);
    const value = readEditorValue(node);
    syncEmptyState(node, value);
    editor.onInput(value);
    editor.syncSelection();
  };

  return (
    <div
      ref={editor.contentEditableRef}
      className={`koma-render-inline-editor${editor.canvasSelection ? ' koma-render-inline-editor--canvas-selection' : ''}`}
      contentEditable
      role="textbox"
      tabIndex={0}
      aria-multiline="true"
      aria-label={t('dashboard.renderText.editAria')}
      spellCheck={false}
      suppressContentEditableWarning
      style={editor.contentEditableStyle}
      data-empty={editor.state.value.length === 0 ? 'true' : undefined}
      data-placeholder={t('dashboard.renderText.editPlaceholder')}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (!editor.canvasSelection) {
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const offset = resolvePointerOffset(event);
        if (offset === null) return;
        event.currentTarget.focus();
        if (event.detail >= 2) {
          const range = resolveInlineEditorWordRange(
            editor.state.value,
            offset,
          );
          editor.setSelection(range.start, range.end);
          dragAnchorRef.current = null;
          return;
        }
        dragAnchorRef.current = offset;
        editor.setSelection(offset, offset);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragAnchorRef.current === null || (event.buttons & 1) === 0) {
          return;
        }
        const offset = resolvePointerOffset(event);
        if (offset === null) return;
        editor.setSelection(
          Math.min(dragAnchorRef.current, offset),
          Math.max(dragAnchorRef.current, offset),
        );
      }}
      onPointerUp={(event) => {
        dragAnchorRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!editor.canvasSelection) return;
        event.preventDefault();
        const offset = resolvePointerOffset(event);
        if (offset === null) return;
        const range = resolveInlineEditorWordRange(
          editor.state.value,
          offset,
        );
        editor.setSelection(range.start, range.end);
      }}
      onPaste={(event) => {
        if (!editor.canvasSelection) return;
        event.preventDefault();
        event.stopPropagation();
        const text = normalizeInlineEditorPlainText(
          event.clipboardData.getData('text/plain'),
        );
        if (text.length > 0) insertPlainText(text);
      }}
      onInput={(event) => {
        if (editor.canvasSelection) syncTrailingLineBreak(event.currentTarget);
        const nextValue = readEditorValue(event.currentTarget);
        syncEmptyState(event.currentTarget, nextValue);
        editor.onInput(nextValue);
        editor.syncSelection();
      }}
      onCompositionStart={() => {
        editor.beginComposition();
      }}
      onCompositionEnd={(event) => {
        editor.endComposition();
        if (editor.canvasSelection) syncTrailingLineBreak(event.currentTarget);
        editor.onInput(readEditorValue(event.currentTarget));
        editor.syncSelection();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          editor.cancel();
          return;
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.stopPropagation();
          editor.save();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && !event.altKey) {
          const shortcut = event.key.toLowerCase();
          if (shortcut === 'b' || shortcut === 'i' || shortcut === 'u') {
            // Browser rich-text commands are lost when the draft is read as
            // plain text, so formatting goes through the region style instead.
            event.preventDefault();
            event.stopPropagation();
            editor.toggleFormat(
              shortcut === 'b'
                ? 'bold'
                : shortcut === 'i'
                  ? 'italic'
                  : 'underline',
            );
            return;
          }
        }
        if (
          event.key === 'Enter'
          && editor.canvasSelection
          && !event.nativeEvent.isComposing
        ) {
          // A browser line break becomes a block/`<br>` whose text is invisible
          // to Range offsets; the draft counts it as a newline, so selection
          // and formatting would drift by one character per break.
          event.preventDefault();
          event.stopPropagation();
          insertPlainText('\n');
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation();
        }
      }}
      onBlur={(event) => {
        if (editor.dockPointerDownRef.current) {
          return;
        }
        const nextTarget = event.relatedTarget;
        if (nextTarget && editor.dockRef.current?.contains(nextTarget)) {
          return;
        }
        if (!editor.state.isDirty) {
          editor.setState(null);
          return;
        }
        editor.save();
      }}
      onSelect={editor.syncSelection}
      onKeyUp={editor.syncSelection}
      onMouseUp={editor.syncSelection}
    />
  );
};

export default InlineTextEditorSurface;
