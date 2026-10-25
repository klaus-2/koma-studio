import { useEffect, useMemo } from 'react';
import type React from 'react';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type {
  TypographyStyleFolder,
  TypographyStylePreset,
} from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  cloneRenderStyle,
  isTranslationNoteOverlayRegion,
} from '../../../utils/dashboard.utils';
import {
  cloneRenderTextStyleRanges,
  remapRenderTextStyleRangesAfterTextEdit,
  resolveRenderTextSelectionStyle,
} from '../../../utils/renderTextStyleRanges';
import { resolveInlineEditorTextPaint } from '../../../utils/inlineEditor';
import { resolveRegionTextLayout } from './canvasDrawing';
import {
  resolveInlineEditorLayoutFrame,
  resolveInlineEditorLineBoxes,
  type InlineEditorLayoutFrame,
  type InlineEditorLineBox,
} from '../../../utils/inlineEditorLayout';
import type { RenderTextPreviewContextMenuState } from './RenderTextPreviewContextMenu';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';

interface UseRenderTextPreviewSelectionParams {
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  contextMenu: RenderTextPreviewContextMenuState | null;
  inlineEditor: RenderTextPreviewInlineEditorState | null;
  displayRegionById: Map<string, AioTextRegion>;
  displayRegionsWithDefaults: AioTextRegion[];
  fallbackStyle: RenderTextStyle;
  availableTypographyPresets: TypographyStylePreset[];
  availableTypographyFolders: TypographyStyleFolder[];
  presetSearch: string;
  presetFolderFilter: string | null;
  renderStageActive: boolean;
  active: boolean;
  editable: boolean;
  areaSelectionEnabled: boolean;
  inlineEditorRequestKey: string | null;
  inlineEditorDisplayScale: number;
  openInlineEditorForRegion: (region: AioTextRegion) => void;
}

export const useRenderTextPreviewSelection = ({
  selectedRegionId,
  hoveredRegionId,
  contextMenu,
  inlineEditor,
  displayRegionById,
  displayRegionsWithDefaults,
  fallbackStyle,
  availableTypographyPresets,
  availableTypographyFolders,
  presetSearch,
  presetFolderFilter,
  renderStageActive,
  active,
  editable,
  areaSelectionEnabled,
  inlineEditorRequestKey,
  inlineEditorDisplayScale,
  openInlineEditorForRegion,
}: UseRenderTextPreviewSelectionParams) => {
  const selectedRegion = useMemo(
    () =>
      selectedRegionId
        ? (displayRegionById.get(selectedRegionId) ?? null)
        : null,
    [displayRegionById, selectedRegionId],
  );

  const inlineEditorRegion = useMemo(
    () =>
      inlineEditor
        ? (displayRegionById.get(inlineEditor.regionId) ?? null)
        : null,
    [displayRegionById, inlineEditor],
  );

  const selectedRegionTextStyleRanges = useMemo(
    () => cloneRenderTextStyleRanges(selectedRegion?.renderTextStyleRanges),
    [selectedRegion],
  );
  const inlineEditorBaseStyle = useMemo(
    () =>
      cloneRenderStyle(inlineEditorRegion?.renderStyle ?? fallbackStyle),
    [fallbackStyle, inlineEditorRegion],
  );
  const inlineEditorLayout = useMemo<{
    frame: InlineEditorLayoutFrame;
    lines: InlineEditorLineBox[];
  }>(() => {
    const fallbackFrame: InlineEditorLayoutFrame = {
      fontSize: 12,
      lineHeight: 17,
      paddingTop: 0,
      paddingLeft: 0,
      paddingRight: 0,
      textAlign: 'left',
    };
    if (
      !inlineEditor
      || !inlineEditorRegion
      || typeof document === 'undefined'
    ) {
      return { frame: fallbackFrame, lines: [] };
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { frame: fallbackFrame, lines: [] };
    }
    // Same measure source the painter uses (trimmed text, shared layout
    // cache): selection line boxes must sit exactly on the painted glyphs.
    // Draft ranges are derived, never stored: the region's ranges remapped
    // onto the edited text (identity once a format flush reset originalValue).
    const { layout, shape } = resolveRegionTextLayout(ctx, {
      region: inlineEditorRegion,
      text: inlineEditor.value,
      style: inlineEditorBaseStyle,
      styleRanges: remapRenderTextStyleRangesAfterTextEdit(
        inlineEditor.originalValue,
        inlineEditor.value,
        inlineEditorBaseStyle,
        inlineEditorRegion.renderTextStyleRanges,
      ),
      renderStageActive: true,
    });
    // Free GPU texture memory immediately.
    canvas.width = 0;
    canvas.height = 0;
    return {
      frame: resolveInlineEditorLayoutFrame({
        bbox: inlineEditorRegion.bbox,
        layout,
        style: inlineEditorBaseStyle,
        shape,
        displayScale: inlineEditorDisplayScale,
      }),
      lines: resolveInlineEditorLineBoxes({
        text: inlineEditor.value,
        bbox: inlineEditorRegion.bbox,
        layout,
        style: inlineEditorBaseStyle,
        shape,
      }),
    };
  }, [
    inlineEditor?.originalValue,
    inlineEditor?.value,
    inlineEditorBaseStyle,
    inlineEditorDisplayScale,
    inlineEditorRegion?.bbox,
    inlineEditorRegion?.renderTextStyleRanges,
    inlineEditorRegion?.shape,
  ]);
  const inlineEditorLayoutFrame = inlineEditorLayout.frame;
  const inlineEditorLineBoxes = inlineEditorLayout.lines;
  const segmentOverlayBoxes = useMemo(
    () =>
      displayRegionsWithDefaults.flatMap((region) => {
        const boxes = region.mergedSegmentBoxes?.length
          ? region.mergedSegmentBoxes
          : (region.segmentBoxes ?? []);

        return boxes.map((segmentBox, idx) => ({
          key: `render-seg-${region.id}-${idx}`,
          box: segmentBox,
        }));
      }),
    [displayRegionsWithDefaults],
  );
  const hoveredRegion = useMemo(
    () => (hoveredRegionId ? displayRegionById.get(hoveredRegionId) ?? null : null),
    [displayRegionById, hoveredRegionId],
  );
  const contextMenuTargetRegion = useMemo(
    () =>
      contextMenu?.regionId
        ? displayRegionById.get(contextMenu.regionId) ?? null
        : null,
    [contextMenu?.regionId, displayRegionById],
  );
  const typographyFolderNameById = useMemo(() => {
    const next = new Map<string, string>();
    availableTypographyFolders.forEach((folder) => {
      next.set(folder.id, folder.name);
    });
    return next;
  }, [availableTypographyFolders]);
  const filteredTypographyPresets = useMemo(() => {
    const searchLower = presetSearch.toLowerCase();

    return availableTypographyPresets.filter((preset) => {
      const matchesSearch =
        !searchLower || preset.name.toLowerCase().includes(searchLower);
      const matchesFolder =
        presetFolderFilter === null
          ? true
          : presetFolderFilter === '__none'
            ? preset.folderId === null
            : preset.folderId === presetFolderFilter;

      return matchesSearch && matchesFolder;
    });
  }, [availableTypographyPresets, presetFolderFilter, presetSearch]);
  const groupedTypographyPresets = useMemo(() => {
    const grouped = new Map<string | null, TypographyStylePreset[]>();

    filteredTypographyPresets.forEach((preset) => {
      const key = preset.folderId ?? null;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(preset);
    });

    return Array.from(grouped.entries());
  }, [filteredTypographyPresets]);
  const inlineEditorPaint = useMemo(
    () =>
      resolveInlineEditorTextPaint(
        inlineEditorBaseStyle,
        inlineEditorDisplayScale,
      ),
    [inlineEditorBaseStyle, inlineEditorDisplayScale],
  );
  const inlineEditorUsesCanvasSelection = inlineEditorLineBoxes.length > 0;
  const inlineEditorContentEditableStyle = useMemo<React.CSSProperties>(
    () => ({
      fontFamily: inlineEditorBaseStyle.fontFamily,
      fontSize: `${inlineEditorLayoutFrame.fontSize}px`,
      lineHeight: `${inlineEditorLayoutFrame.lineHeight}px`,
      fontWeight: inlineEditorBaseStyle.bold ? 700 : 400,
      fontStyle: inlineEditorBaseStyle.italic ? 'italic' : 'normal',
      textTransform: inlineEditorBaseStyle.uppercase ? 'uppercase' : 'none',
      textDecoration: inlineEditorBaseStyle.underline ? 'underline' : 'none',
      textAlign: inlineEditorLayoutFrame.textAlign,
      paddingTop: `${inlineEditorLayoutFrame.paddingTop}px`,
      paddingLeft: `${inlineEditorLayoutFrame.paddingLeft}px`,
      paddingRight: `${inlineEditorLayoutFrame.paddingRight}px`,
      color: inlineEditorUsesCanvasSelection
        ? 'transparent'
        : inlineEditorPaint.color,
      WebkitTextFillColor: inlineEditorUsesCanvasSelection
        ? 'transparent'
        : inlineEditorPaint.color,
      caretColor: inlineEditorUsesCanvasSelection
        ? 'transparent'
        : inlineEditorPaint.color,
      textShadow: inlineEditorUsesCanvasSelection
        ? undefined
        : inlineEditorPaint.textShadow,
      WebkitTextStroke: inlineEditorUsesCanvasSelection
        ? undefined
        : inlineEditorPaint.textStroke,
    }),
    [
      inlineEditorBaseStyle,
      inlineEditorLayoutFrame,
      inlineEditorPaint,
      inlineEditorUsesCanvasSelection,
    ],
  );
  const selectedInlineSelectionActive = Boolean(
    inlineEditor
    && selectedRegion
    && inlineEditor.regionId === selectedRegion.id
    && inlineEditor.selectionEnd > inlineEditor.selectionStart,
  );
  const selectedRegionStyle = useMemo(
    () => {
      const baseStyle = cloneRenderStyle(selectedRegion?.renderStyle ?? fallbackStyle);
      if (!selectedRegion || !selectedInlineSelectionActive || !inlineEditor) {
        return baseStyle;
      }
      return resolveRenderTextSelectionStyle(
        selectedRegion.renderText ?? '',
        baseStyle,
        selectedRegionTextStyleRanges,
        inlineEditor.selectionStart,
        inlineEditor.selectionEnd,
      );
    },
    [
      fallbackStyle,
      inlineEditor,
      selectedInlineSelectionActive,
      selectedRegion,
      selectedRegionTextStyleRanges,
    ],
  );
  const selectedRegionIsNoteOverlay = Boolean(
    selectedRegion && isTranslationNoteOverlayRegion(selectedRegion),
  );

  const selectedRegionHasText = useMemo(
    () =>
      renderStageActive && (selectedRegion?.renderText ?? '').trim().length > 0,
    [renderStageActive, selectedRegion],
  );
  const inlineEditorIsActiveForSelected = useMemo(
    () =>
      Boolean(
        inlineEditor &&
        selectedRegion &&
        inlineEditor.regionId === selectedRegion.id,
      ),
    [inlineEditor, selectedRegion],
  );
  useEffect(() => {
    if (!inlineEditorRequestKey || !active || !selectedRegion) return;
    const [requestedRegionId] = inlineEditorRequestKey.split('::');
    if (!requestedRegionId || requestedRegionId !== selectedRegion.id) return;
    openInlineEditorForRegion(selectedRegion);
  }, [
    active,
    inlineEditorRequestKey,
    openInlineEditorForRegion,
    selectedRegion,
  ]);
  const showRenderDock = useMemo(
    () =>
      Boolean(
        editable &&
        renderStageActive &&
        areaSelectionEnabled &&
        selectedRegion &&
        (selectedRegionHasText || inlineEditorIsActiveForSelected),
      ),
    [editable, renderStageActive, areaSelectionEnabled, selectedRegion, selectedRegionHasText, inlineEditorIsActiveForSelected],
  );

  return {
    selectedRegion,
    selectedRegionTextStyleRanges,
    segmentOverlayBoxes,
    hoveredRegion,
    contextMenuTargetRegion,
    typographyFolderNameById,
    filteredTypographyPresets,
    groupedTypographyPresets,
    inlineEditorContentEditableStyle,
    inlineEditorLineBoxes,
    inlineEditorPaint,
    inlineEditorUsesCanvasSelection,
    selectedInlineSelectionActive,
    selectedRegionStyle,
    selectedRegionIsNoteOverlay,
    selectedRegionHasText,
    inlineEditorIsActiveForSelected,
    showRenderDock,
  };
};
