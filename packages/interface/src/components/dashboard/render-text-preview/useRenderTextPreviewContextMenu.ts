// Context menu wiring for RenderTextPreview: clipboard copy actions,
// preset/shape dispatch, region removal, hover tooltip content, plus the
// segment-brush canvas observers that sit between these callbacks in the
// original hook order. Moved verbatim from RenderTextPreview.tsx (T07 split);
// hook order preserved.

import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../typography/types';
import type { useI18n } from '../../../i18n';
import {
  clamp,
  getRegionTranslationNotesForDisplay,
} from '../../../utils/dashboard.utils';
import type { RenderTextPreviewContextMenuState } from './RenderTextPreviewContextMenu';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';

type Translate = ReturnType<typeof useI18n>['t'];

interface UseRenderTextPreviewContextMenuParams {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  segBrushDataUrlRef: React.RefObject<string | null>;
  redrawSegBrushCanvas: () => void;
  segmentBrushDataUrl: string | null;
  contextMenu: RenderTextPreviewContextMenuState | null;
  setContextMenu: React.Dispatch<
    React.SetStateAction<RenderTextPreviewContextMenuState | null>
  >;
  setContextSubmenu: React.Dispatch<React.SetStateAction<'presets' | null>>;
  setHoveredRegionId: React.Dispatch<React.SetStateAction<string | null>>;
  setInlineEditor: React.Dispatch<
    React.SetStateAction<RenderTextPreviewInlineEditorState | null>
  >;
  displayRegionsWithDefaults: AioTextRegion[];
  regionsWithDefaultsRef: React.RefObject<AioTextRegion[]>;
  editable: boolean;
  renderStageActive: boolean;
  areaSelectionEnabled: boolean;
  selectedRegionId: string | null;
  translationNotesEnabled: boolean;
  t: Translate;
  onCardSelect: () => void;
  onSelectRegion: (regionId: string | null) => void;
  onRegionsChange: (
    next: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  onRequestApplyPresetById?: (regionId: string, presetId: string) => void;
  onRequestConvertShapeRegion?: (
    regionId: string,
    kind: 'auto' | TypographyShapeKind,
  ) => void;
  openInlineEditorForRegion: (region: AioTextRegion) => void;
  getTranslationNoteOverlayParentId: (regionId: string) => string | null;
  updateRegions: (updater: (region: AioTextRegion) => AioTextRegion) => void;
}

export const useRenderTextPreviewContextMenu = ({
  overlayRef,
  segBrushDataUrlRef,
  redrawSegBrushCanvas,
  segmentBrushDataUrl,
  contextMenu,
  setContextMenu,
  setContextSubmenu,
  setHoveredRegionId,
  setInlineEditor,
  displayRegionsWithDefaults,
  regionsWithDefaultsRef,
  editable,
  renderStageActive,
  areaSelectionEnabled,
  selectedRegionId,
  translationNotesEnabled,
  t,
  onCardSelect,
  onSelectRegion,
  onRegionsChange,
  onRequestApplyPresetById,
  onRequestConvertShapeRegion,
  openInlineEditorForRegion,
  getTranslationNoteOverlayParentId,
  updateRegions,
}: UseRenderTextPreviewContextMenuParams) => {
  const getTooltipContent = useCallback(
    (
      region: AioTextRegion,
    ): { recognized: string; translated: string; notes: string } => {
      const recognized = (region.recognizedText ?? '').trim();
      const translated = (region.translatedText ?? '').trim();
      const notes = getRegionTranslationNotesForDisplay(
        region,
        translationNotesEnabled,
      );
      return {
        recognized:
          recognized.length > 0 ? recognized : t('dashboard.render.noRecognizedText'),
        translated:
          translated.length > 0 ? translated : t('dashboard.render.noTranslation'),
        notes: notes.length > 0 ? notes.join(' | ') : t('dashboard.render.noNotes'),
      };
    },
    [translationNotesEnabled, t],
  );

  useEffect(() => {
    const container = overlayRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => redrawSegBrushCanvas());
    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawSegBrushCanvas]);

  useEffect(() => {
    segBrushDataUrlRef.current = segmentBrushDataUrl ?? null;
    redrawSegBrushCanvas();
  }, [segmentBrushDataUrl, redrawSegBrushCanvas]);

  const copyTextToClipboard = useCallback(async (text: string) => {
    const normalized = text.trim();
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized);
      return;
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = normalized;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, []);

  const handleRegionContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, region: AioTextRegion) => {
      event.preventDefault();
      event.stopPropagation();
      onCardSelect();
      if (!areaSelectionEnabled) return;
      onSelectRegion(region.id);
      const node = overlayRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const x = clamp(
        event.clientX - rect.left,
        6,
        Math.max(6, rect.width - 6),
      );
      const y = clamp(
        event.clientY - rect.top,
        6,
        Math.max(6, rect.height - 6),
      );
      setContextMenu({ regionId: region.id, x, y });
      setContextSubmenu(null);
      setHoveredRegionId(region.id);
    },
    [areaSelectionEnabled, onCardSelect, onSelectRegion],
  );

  const handleContextCopyRecognized = useCallback(() => {
    if (!contextMenu) return;
    const region = displayRegionsWithDefaults.find(
      (item) => item.id === contextMenu.regionId,
    );
    if (!region) return;
    void copyTextToClipboard(region.recognizedText ?? '');
    setContextMenu(null);
    setContextSubmenu(null);
  }, [contextMenu, copyTextToClipboard, displayRegionsWithDefaults]);

  const handleContextCopyTranslated = useCallback(() => {
    if (!contextMenu) return;
    const region = displayRegionsWithDefaults.find(
      (item) => item.id === contextMenu.regionId,
    );
    if (!region) return;
    void copyTextToClipboard(region.translatedText ?? '');
    setContextMenu(null);
    setContextSubmenu(null);
  }, [contextMenu, copyTextToClipboard, displayRegionsWithDefaults]);

  const handleContextEditRendered = useCallback(() => {
    if (!contextMenu || !editable || !renderStageActive) return;
    const region = displayRegionsWithDefaults.find(
      (item) => item.id === contextMenu.regionId,
    );
    if (!region) return;
    openInlineEditorForRegion(region);
    setContextSubmenu(null);
  }, [
    contextMenu,
    displayRegionsWithDefaults,
    editable,
    openInlineEditorForRegion,
    renderStageActive,
  ]);

  const handleContextApplyPresetById = useCallback(
    (presetId: string) => {
      if (!contextMenu || !onRequestApplyPresetById) return;
      if (!presetId) return;
      onRequestApplyPresetById(contextMenu.regionId, presetId);
      setContextMenu(null);
      setContextSubmenu(null);
    },
    [contextMenu, onRequestApplyPresetById],
  );

  const handleContextConvertShape = useCallback(
    (kind: 'auto' | TypographyShapeKind) => {
      if (!contextMenu || !onRequestConvertShapeRegion) return;
      onRequestConvertShapeRegion(contextMenu.regionId, kind);
      setContextMenu(null);
      setContextSubmenu(null);
    },
    [contextMenu, onRequestConvertShapeRegion],
  );

  const removeRegionById = useCallback(
    (regionId: string) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      if (parentId) {
        updateRegions((region) =>
          region.id === parentId
            ? {
                ...region,
                translationNotes: undefined,
                translationNoteOverlay: undefined,
              }
            : region,
        );
        onSelectRegion(parentId);
        setContextMenu(null);
        setInlineEditor((prev) => (prev?.regionId === regionId ? null : prev));
        return;
      }
      const nextRegions = regionsWithDefaultsRef.current.filter(
        (region) => region.id !== regionId,
      );
      onRegionsChange(nextRegions);
      if (selectedRegionId === regionId) {
        onSelectRegion(nextRegions[0]?.id ?? null);
      }
      setContextMenu(null);
      setInlineEditor((prev) => (prev?.regionId === regionId ? null : prev));
    },
    [
      getTranslationNoteOverlayParentId,
      onRegionsChange,
      onSelectRegion,
      selectedRegionId,
      updateRegions,
    ],
  );

  const handleContextRemoveRegion = useCallback(() => {
    if (!contextMenu || !editable) return;
    removeRegionById(contextMenu.regionId);
  }, [contextMenu, editable, removeRegionById]);

  return {
    getTooltipContent,
    handleRegionContextMenu,
    handleContextCopyRecognized,
    handleContextCopyTranslated,
    handleContextEditRendered,
    handleContextApplyPresetById,
    handleContextConvertShape,
    removeRegionById,
    handleContextRemoveRegion,
  };
};
