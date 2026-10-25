// Shared test factories for the inline editor state and surface handle.
import { vi, type Mock } from 'vitest';

import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';
import type { InlineTextEditorHandle } from './InlineTextEditorSurface';

export type InlineTextEditorHandleMock = InlineTextEditorHandle & {
  onInput: Mock;
  syncSelection: Mock;
  cancel: Mock;
  save: Mock;
  toggleFormat: Mock;
  setState: Mock;
  beginComposition: Mock;
  endComposition: Mock;
  setSelection: Mock;
};

export const buildInlineEditorState = (
  overrides: Partial<RenderTextPreviewInlineEditorState> = {},
): RenderTextPreviewInlineEditorState => ({
  regionId: 'r1',
  value: 'abc',
  originalValue: 'abc',
  sessionOriginalValue: 'abc',
  sessionOriginalStyleRanges: undefined,
  isDirty: false,
  selectionStart: 3,
  selectionEnd: 3,
  ...overrides,
});

export const buildInlineEditorHandle = (
  overrides: Partial<InlineTextEditorHandle> = {},
): InlineTextEditorHandleMock =>
  ({
    state: buildInlineEditorState(),
    contentEditableRef: { current: null },
    contentEditableStyle: {},
    onInput: vi.fn(),
    syncSelection: vi.fn(),
    cancel: vi.fn(),
    save: vi.fn(),
    toggleFormat: vi.fn(),
    setState: vi.fn(),
    beginComposition: vi.fn(),
    endComposition: vi.fn(),
    selectionLines: [],
    caretColor: '#ffffff',
    canvasSelection: true,
    setSelection: vi.fn(),
    dockPointerDownRef: { current: false },
    dockRef: { current: null },
    ...overrides,
    // Overrides may narrow the mock fields back to plain functions.
  }) as InlineTextEditorHandleMock;
