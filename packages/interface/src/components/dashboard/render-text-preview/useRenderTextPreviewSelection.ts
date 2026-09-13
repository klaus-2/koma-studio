// Derived selection/editor state for RenderTextPreview: selected + hovered
// region lookups, inline editor display metrics/styles, typography preset
// filtering, and the inline-editor request key effect.
// Moved verbatim from RenderTextPreview.tsx (T07 split); hook order preserved.

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
  resolveRenderTextSelectionStyle,
} from '../../../utils/renderTextStyleRanges';
import { computeRenderTextLayout } from '../../../utils/renderText';
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
  const inlineEditorDisplayMetrics = useMemo(() => {
    if (
      !inlineEditor
      || !inlineEditorRegion
      || typeof document === 'undefined'
    ) {
      return { fontSize: 12, lineHeight: 17 };
    }
    const [x1, y1, x2, y2] = inlineEditorRegion.bbox;
    const width = Math.max(1, x2 - x1);
    const height = Math.max(1, y2 - y1);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { fontSize: 12, lineHeight: 17 };
    }
    const layout = computeRenderTextLayout(
      ctx,
      inlineEditor.value,
      width,
      height,
      inlineEditorBaseStyle,
      inlineEditorRegion.shape,
      inlineEditorRegion.renderTextStyleRanges,
    );
    // Free GPU texture memory immediately.
    canvas.width = 0;
    canvas.height = 0;
    return {
      fontSize: layout.fontSize,
      lineHeight: Math.max(layout.lineHeight, layout.fontSize * 1.05),
    };
  }, [
    inlineEditor?.value,
    inlineEditorBaseStyle,
    inlineEditorRegion?.bbox,
    inlineEditorRegion?.renderTextStyleRanges,
    inlineEditorRegion?.shape,
  ]);
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
  const inlineEditorTypographyStyle = useMemo<React.CSSProperties>(
    () => ({
      fontFamily: inlineEditorBaseStyle.fontFamily,
      fontSize: `${inlineEditorDisplayMetrics.fontSize}px`,
      lineHeight: `${inlineEditorDisplayMetrics.lineHeight}px`,
      fontWeight: inlineEditorBaseStyle.bold ? 700 : 400,
      fontStyle: inlineEditorBaseStyle.italic ? 'italic' : 'normal',
      textTransform: inlineEditorBaseStyle.uppercase ? 'uppercase' : 'none',
    }),
    [inlineEditorBaseStyle, inlineEditorDisplayMetrics],
  );
  const inlineEditorContentEditableStyle = useMemo<React.CSSProperties>(
    () => ({
      ...inlineEditorTypographyStyle,
      color: inlineEditorBaseStyle.color || 'var(--auth-text)',
      caretColor: inlineEditorBaseStyle.color || 'var(--auth-text)',
      outline: 'none',
      overflow: 'auto',
    }),
    [inlineEditorTypographyStyle, inlineEditorBaseStyle],
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
    inlineEditorRegion,
    selectedRegionTextStyleRanges,
    inlineEditorBaseStyle,
    inlineEditorDisplayMetrics,
    segmentOverlayBoxes,
    hoveredRegion,
    contextMenuTargetRegion,
    typographyFolderNameById,
    filteredTypographyPresets,
    groupedTypographyPresets,
    inlineEditorTypographyStyle,
    inlineEditorContentEditableStyle,
    selectedInlineSelectionActive,
    selectedRegionStyle,
    selectedRegionIsNoteOverlay,
    selectedRegionHasText,
    inlineEditorIsActiveForSelected,
    showRenderDock,
  };
};
