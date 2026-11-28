
import { useCallback, useEffect, useId } from 'react';
import type React from 'react';
import { useExclusiveOverlay } from '@koma/ui/stores/overlay-coordinator';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../typography/types';
import type { useI18n } from '../../../i18n';
import {
  clamp,
  getRegionTranslationNotesForDisplay,
} from '../../../utils/dashboard.utils';
import { isRegionFieldLocked, withRegionLockField } from '../../../utils/region-lock';
import type { RegionLockField } from '../../../utils/region-lock';
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

  const menuOverlayId = `ctx-render:${useId()}`;
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setContextSubmenu(null);
  }, [setContextMenu, setContextSubmenu]);

  useExclusiveOverlay(menuOverlayId, contextMenu !== null, closeContextMenu);

  useEffect(() => {
    if (!contextMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-koma-ctx-menu]')) return;
      closeContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, closeContextMenu]);

  const handleRegionContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, region: AioTextRegion) => {
      event.preventDefault();
      event.stopPropagation();
      onCardSelect();
      if (!areaSelectionEnabled) return;
      onSelectRegion(region.id);
      const viewportW =
        typeof window !== 'undefined' && window.innerWidth > 0
          ? window.innerWidth
          : 1280;
      const viewportH =
        typeof window !== 'undefined' && window.innerHeight > 0
          ? window.innerHeight
          : 800;
      const menuWidth = 232;
      const menuHeight = 368;
      const margin = 8;
      const x = clamp(
        event.clientX,
        margin,
        Math.max(margin, viewportW - menuWidth - margin),
      );
      const y = clamp(
        event.clientY,
        margin,
        Math.max(margin, viewportH - menuHeight - margin),
      );
      setContextMenu({ regionId: region.id, x, y });
      setContextSubmenu(null);
      setHoveredRegionId(region.id);
    },
    [areaSelectionEnabled, onCardSelect, onSelectRegion, setContextMenu, setContextSubmenu, setHoveredRegionId],
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

  const toggleRegionLockField = useCallback(
    (field: RegionLockField) => {
      if (!contextMenu || !editable) return;
      updateRegions((region) =>
        region.id === contextMenu.regionId
          ? withRegionLockField(
              region,
              field,
              !isRegionFieldLocked(region, field),
            )
          : region,
      );
      setContextMenu(null);
    },
    [contextMenu, editable, setContextMenu, updateRegions],
  );

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
    toggleRegionLockField,
  };
};
